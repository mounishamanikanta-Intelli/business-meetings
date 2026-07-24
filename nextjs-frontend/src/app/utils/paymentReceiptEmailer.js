const nodemailer = require('nodemailer');
const { createClient } = require('next-sanity');

// Import jsPDF for PDF generation
let jsPDF;
try {
  jsPDF = require('jspdf').jsPDF;
} catch (error) {
  console.warn('jsPDF not available for PDF generation:', error.message);
}

// Import fetch for Node.js environments that don't have it globally
const fetch = globalThis.fetch || require('node-fetch');

/**
 * Payment Receipt Email Generator with Sanity CMS Integration
 * Features:
 * - Fetches footer logo from Sanity CMS
 * - Generates downloadable PDF receipts
 * - Uses navy blue branding colors (#0f172a, #1e3a8a)
 * - Sends professional receipt emails via contactus@intelliglobalconferences.com only
 */

// Brand colors matching website design
const BRAND_COLORS = {
  navyBlue: '#0f172a',      // slate-900 - Primary navy
  blueAccent: '#1e3a8a',    // blue-800 - Secondary navy
  lightBlue: '#1e40af',     // blue-700 - Accent
  white: '#ffffff',
  gray: '#666666',
  darkGray: '#333333',
  success: '#28a745'
};

// Sanity client configuration - DYNAMIC from environment
const sanityClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'zt8218vh',
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2023-05-03',
  useCdn: true,
  token: process.env.SANITY_API_TOKEN, // For authenticated requests
});

// Sanity write client for uploading PDFs
const sanityWriteClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'n3no08m3',
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2023-05-03',
  useCdn: false,
  token: process.env.SANITY_API_TOKEN, // Required for uploads
});

/**
 * UNIFIED BLUE HEADER PDF GENERATION - SINGLE SOURCE OF TRUTH
 * This function ensures ONLY the blue header template is used for all client receipts
 * Replaces all other PDF generation methods to prevent white template issues
 */
async function generateReceiptPDF(paymentData, registrationData, footerLogo) {
  // Import the unified blue header generator
  const { generateBlueHeaderReceiptPDF } = require('./unifiedReceiptGenerator');

  console.log('🧾 Using UNIFIED blue header PDF generation...');
  return await generateBlueHeaderReceiptPDF(paymentData, registrationData);



}

/**
 * Upload PDF buffer to Sanity CMS as an asset
 */
async function uploadPDFToSanity(pdfBuffer, filename) {
  try {
    console.log(`📤 Uploading PDF to Sanity: ${filename}`);

    if (!process.env.SANITY_API_TOKEN) {
      console.warn('⚠️  SANITY_API_TOKEN not found, cannot upload PDF');
      return null;
    }

    // Upload the PDF as an asset
    const asset = await sanityWriteClient.assets.upload('file', pdfBuffer, {
      filename: filename,
      contentType: 'application/pdf'
    });

    console.log(`✅ PDF uploaded to Sanity successfully: ${asset._id}`);
    return asset;

  } catch (error) {
    console.error('❌ Failed to upload PDF to Sanity:', error.message);
    return null;
  }
}

/**
 * Update registration record with PDF receipt asset
 */
async function updateRegistrationWithPDF(registrationId, pdfAsset) {
  try {
    console.log(`🔄 Updating registration ${registrationId} with PDF asset...`);

    if (!pdfAsset || !process.env.SANITY_API_TOKEN) {
      console.warn('⚠️  Cannot update registration: missing PDF asset or API token');
      return false;
    }

    // Find the registration document
    const registration = await sanityWriteClient.fetch(
      `*[_type == "conferenceRegistration" && (_id == $id || registrationId == $regId)][0]`,
      { id: registrationId, regId: registrationId }
    );

    if (!registration) {
      console.warn(`⚠️  Registration not found: ${registrationId}`);
      return false;
    }

    // Update the registration with PDF asset
    const updateData = {
      pdfReceipt: {
        _type: 'file',
        asset: {
          _type: 'reference',
          _ref: pdfAsset._id
        }
      },
      // Also update the registrationTable data
      'registrationTable.pdfReceiptFile': {
        _type: 'file',
        asset: {
          _type: 'reference',
          _ref: pdfAsset._id
        }
      },
      lastUpdated: new Date().toISOString()
    };

    await sanityWriteClient.patch(registration._id).set(updateData).commit();

    console.log(`✅ Registration updated with PDF asset: ${registration._id}`);
    return true;

  } catch (error) {
    console.error('❌ Failed to update registration with PDF:', error.message);
    return false;
  }
}

/**
 * Fetch dynamic site settings from Sanity CMS
 */
async function getSiteSettings() {
  try {
    const query = `*[_type == "siteSettings"][0]{
      _id,
      logo{
        asset->{
          _id,
          url
        },
        alt
      },
      contactInfo{
        email,
        phone,
        address
      },
      footerContent{
        footerLogo{
          asset->{
            _id,
            url
          },
          alt
        }
      },
      adminSettings{
        emailSettings{
          smtpHost,
          smtpPort,
          smtpUser,
          smtpSecure,
          fromEmail,
          fromName
        }
      }
    }`;

    const siteSettings = await sanityClient.fetch(query);
    console.log('✅ Site settings fetched from Sanity CMS');
    return siteSettings;
  } catch (error) {
    console.error('⚠️  Failed to fetch site settings from Sanity:', error.message);
    return null;
  }
}

/**
 * Get footer logo from site settings
 */
async function getFooterLogo() {
  try {
    const siteSettings = await getSiteSettings();
    const footerLogo = siteSettings?.footerContent?.footerLogo;

    if (footerLogo?.asset?.url) {
      return {
        url: footerLogo.asset.url,
        alt: footerLogo.alt || 'Intelli Global Conferences Logo'
      };
    }

    return null;
  } catch (error) {
    console.error('⚠️  Failed to fetch footer logo from Sanity:', error.message);
    return null;
  }
}

/**
 * Get dynamic email configuration from Sanity CMS or environment
 */
async function getEmailConfig() {
  try {
    const siteSettings = await getSiteSettings();
    const emailSettings = siteSettings?.adminSettings?.emailSettings;

    // PRODUCTION: Prioritize environment variables for production deployment
    const productionConfig = {
      host: process.env.SMTP_HOST || 'smtp.hostinger.com',
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_SECURE === 'true' || true,
      user: process.env.SMTP_USER || 'contactus@intelliglobalconferences.com',
      pass: process.env.SMTP_PASS, // Always from environment for security
      fromEmail: process.env.EMAIL_FROM || 'contactus@intelliglobalconferences.com',
      fromName: process.env.EMAIL_FROM_NAME || 'Intelli Global Conferences'
    };

    // Use Sanity settings as fallback only if environment variables are not set
    if (!process.env.SMTP_HOST && emailSettings?.smtpHost) {
      productionConfig.host = emailSettings.smtpHost;
    }
    if (!process.env.SMTP_PORT && emailSettings?.smtpPort) {
      productionConfig.port = parseInt(emailSettings.smtpPort);
    }
    if (!process.env.SMTP_USER && emailSettings?.smtpUser) {
      productionConfig.user = emailSettings.smtpUser;
    }
    if (!process.env.EMAIL_FROM && emailSettings?.fromEmail) {
      productionConfig.fromEmail = emailSettings.fromEmail;
    }
    if (!process.env.EMAIL_FROM_NAME && emailSettings?.fromName) {
      productionConfig.fromName = emailSettings.fromName;
    }

    return productionConfig;
  } catch (error) {
    console.error('⚠️  Failed to fetch email config from Sanity, using environment defaults:', error.message);
    return {
      host: process.env.SMTP_HOST || 'smtp.hostinger.com',
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_SECURE === 'true' || true,
      user: process.env.SMTP_USER || 'contactus@intelliglobalconferences.com',
      pass: process.env.SMTP_PASS,
      fromEmail: process.env.EMAIL_FROM || 'contactus@intelliglobalconferences.com',
      fromName: process.env.EMAIL_FROM_NAME || 'Intelli Global Conferences'
    };
  }
}

/**
 * Send payment receipt email with UNIFIED blue header PDF
 * @param {Object} paymentData - Payment information
 * @param {Object} registrationData - Registration information
 * @param {string} recipientEmail - Email address to send receipt to
 */
async function sendPaymentReceiptEmail(paymentData, registrationData, recipientEmail) {
  try {
    console.log('🧾 Starting UNIFIED receipt email system...');

    // Fetch receipt settings from Sanity
    const { getReceiptSettings } = require('./unifiedReceiptGenerator');
    const receiptSettings = await getReceiptSettings();

    console.log('🎛️ Using dynamic receipt settings from Sanity:');
    console.log(`   📋 Conference Title: "${receiptSettings.conferenceTitle}"`);
    console.log(`   🏢 Company Name: "${receiptSettings.companyName}"`);
    console.log(`   📧 Sender Email: "${receiptSettings.emailSettings?.senderEmail}"`);
    console.log(`   🎨 Blue Header: ${receiptSettings.receiptTemplate?.useBlueHeader}`);

    // Generate ONLY the blue header PDF (no white template)
    let pdfBuffer = null;
    try {
      pdfBuffer = await generateReceiptPDF(paymentData, registrationData);
      console.log('✅ BLUE HEADER PDF receipt generated successfully');
    } catch (pdfError) {
      console.warn('⚠️  PDF generation failed, continuing with email only:', pdfError.message);
    }

    // Configure SMTP transporter with Coolify-optimized production settings
    const smtpConfig = {
      host: process.env.SMTP_HOST || 'smtp.hostinger.com',
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_SECURE === 'true' || true,
      auth: {
        user: process.env.SMTP_USER || 'contactus@intelliglobalconferences.com',
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false,
        servername: process.env.SMTP_HOST || 'smtp.hostinger.com',
        ciphers: 'HIGH:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!SRP:!CAMELLIA'
      },
      connectionTimeout: 60000, // 60 seconds
      greetingTimeout: 30000,   // 30 seconds
      socketTimeout: 60000,     // 60 seconds
      pool: false,              // Disable connection pooling for Coolify
      maxConnections: 1,        // Single connection for container environments
      debug: process.env.NODE_ENV !== 'production', // Enable debug in development
      logger: process.env.NODE_ENV !== 'production'  // Enable logging in development
    };

    console.log('📧 SMTP Configuration:', {
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      user: smtpConfig.auth.user,
      hasPassword: !!smtpConfig.auth.pass,
      environment: process.env.NODE_ENV
    });

    const transporter = nodemailer.createTransport(smtpConfig);

    // Verify SMTP connection before sending
    try {
      console.log('🔍 Verifying SMTP connection...');
      await transporter.verify();
      console.log('✅ SMTP connection verified successfully');
    } catch (verifyError) {
      console.error('❌ SMTP verification failed:', verifyError.message);
      console.error('📧 SMTP Config Debug:', {
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        user: smtpConfig.auth.user,
        hasPassword: !!smtpConfig.auth.pass
      });

      // Try alternative SMTP configuration for production
      if (process.env.NODE_ENV === 'production') {
        console.log('🔄 Trying multiple alternative SMTP configurations for Coolify...');

        const alternativeConfigs = [
          {
            name: 'Port 587 with STARTTLS',
            config: {
              ...smtpConfig,
              port: 587,
              secure: false,
              tls: {
                rejectUnauthorized: false,
                starttls: true,
                servername: process.env.SMTP_HOST || 'smtp.hostinger.com'
              }
            }
          },
          {
            name: 'Coolify-optimized configuration',
            config: {
              ...smtpConfig,
              port: 587,
              secure: false,
              pool: false,
              maxConnections: 1,
              tls: {
                rejectUnauthorized: false,
                servername: process.env.SMTP_HOST || 'smtp.hostinger.com',
                ciphers: 'HIGH:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!SRP:!CAMELLIA'
              },
              connectionTimeout: 30000,
              greetingTimeout: 15000,
              socketTimeout: 30000
            }
          }
        ];

        let workingTransporter = null;

        for (const { name, config } of alternativeConfigs) {
          try {
            console.log(`🔍 Testing: ${name}`);
            const altTransporter = nodemailer.createTransport(config);
            await altTransporter.verify();
            console.log(`✅ ${name} verified successfully`);
            workingTransporter = altTransporter;
            break;
          } catch (altError) {
            console.error(`❌ ${name} failed:`, altError.message);
          }
        }

        if (workingTransporter) {
          // Use the working alternative transporter
          Object.assign(transporter, workingTransporter);
        } else {
          console.error('❌ All alternative SMTP configurations failed');
          throw new Error(`All SMTP configurations failed. Original error: ${verifyError.message}`);
        }
      } else {
        throw verifyError;
      }
    }

    // CRITICAL: Log email recipient to verify it's from registration form, not PayPal
    console.log('🎯 EMAIL SYSTEM - RECIPIENT VERIFICATION:');
    console.log('   📧 Email Recipient:', recipientEmail);
    console.log('   📋 Customer Name (from registration):', `${registrationData.personalDetails?.firstName || ''} ${registrationData.personalDetails?.lastName || ''}`.trim());
    console.log('   ✅ Email should go to REGISTRATION FORM email, NOT PayPal account email');
    console.log('   ❌ If recipient is PayPal account email instead of registration form email, there is a data mismatch issue');

    const mailOptions = {
      from: `"${receiptSettings.companyName || 'Intelli Global Conferences'}" <${receiptSettings.emailSettings?.senderEmail || process.env.SMTP_USER || 'contactus@intelliglobalconferences.com'}>`,
      to: recipientEmail,
      subject: `✅ Payment Receipt - ${receiptSettings.conferenceTitle || 'International Nursing Conference 2025'}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payment Receipt</title>
          <style>
            /* Enhanced print styles for consistent PDF and print formatting */
            @media print {
              * {
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
                print-color-adjust: exact !important;
              }

              body {
                margin: 0;
                padding: 0;
                background: white !important;
                font-family: Arial, sans-serif !important;
              }

              .no-print {
                display: none !important;
              }

              /* Ensure header gradient prints correctly */
              .header-gradient {
                background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%) !important;
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
                print-color-adjust: exact !important;
              }

              /* Maintain professional spacing and layout */
              .receipt-container {
                max-width: 100% !important;
                margin: 0 !important;
                box-shadow: none !important;
                border: 1px solid #ddd !important;
              }

              /* Ensure text colors print correctly */
              .text-white {
                color: white !important;
              }

              .text-navy {
                color: #0f172a !important;
              }

              .text-blue {
                color: #1e3a8a !important;
              }

              /* Page break controls */
              .receipt-section {
                page-break-inside: avoid;
              }

              /* Footer positioning */
              .receipt-footer {
                position: fixed;
                bottom: 20px;
                width: 100%;
              }
            }

            /* Screen styles for consistency */
            @media screen {
              .header-gradient {
                background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
              }
            }
          </style>
        </head>
        <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #f5f5f5;">
          
          <!-- Receipt Container -->
          <div id="receipt" class="receipt-container" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

            <!-- Header with Navy Blue Branding -->
            <div class="header-gradient receipt-section" style="background: linear-gradient(135deg, ${BRAND_COLORS.navyBlue} 0%, ${BRAND_COLORS.blueAccent} 50%, ${BRAND_COLORS.navyBlue} 100%); color: white; padding: 30px 20px; text-align: left;">
              ${footerLogo ? `
                <img src="${footerLogo.url}" alt="${footerLogo.alt}"
                     style="height: 60px; width: auto; max-width: 300px; object-fit: contain; margin-bottom: 10px; display: block;
                            border: none; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic;" />
              ` : `
                <h1 style="margin: 0; font-size: 24px; font-weight: bold;">Intelli Global Conferences</h1>
              `}
              <!-- REMOVED: Registration Receipt text as requested -->
            </div>
            
            <!-- Conference Title - DYNAMIC from Sanity -->
            <div style="padding: 20px; background-color: #ffffff;">
              <h2 style="margin: 0; font-size: 18px; color: #333; font-weight: bold;">${receiptSettings.conferenceTitle || 'International Nursing Conference 2025'}</h2>
            </div>
            
            <!-- Payment Information -->
            <div style="padding: 0 20px 20px 20px;">
              <h3 style="color: ${BRAND_COLORS.blueAccent}; font-size: 16px; margin: 0 0 15px 0; font-weight: bold;">Payment Information</h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <tr>
                  <td style="padding: 6px 0; color: #666; width: 140px;">Transaction ID:</td>
                  <td style="padding: 6px 0; color: #333; font-weight: normal;">${paymentData.transactionId || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #666;">Order ID:</td>
                  <td style="padding: 6px 0; color: #333;">${paymentData.orderId || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #666;">Amount:</td>
                  <td style="padding: 6px 0; color: #333; font-weight: bold;">${paymentData.currency || 'USD'} ${paymentData.amount || '0.00'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #666;">Payment Method:</td>
                  <td style="padding: 6px 0; color: #333;">${paymentData.paymentMethod || 'PayPal'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #666;">Payment Date:</td>
                  <td style="padding: 6px 0; color: #333;">${paymentData.paymentDate || new Date().toLocaleString()}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #666;">Status:</td>
                  <td style="padding: 6px 0; color: #28a745; font-weight: bold;">${paymentData.status || 'Completed'}</td>
                </tr>
              </table>
            </div>
            
            <!-- Registration Details -->
            <div style="padding: 0 20px 20px 20px;">
              <h3 style="color: ${BRAND_COLORS.blueAccent}; font-size: 16px; margin: 0 0 15px 0; font-weight: bold;">Registration Details</h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <tr>
                  <td style="padding: 6px 0; color: #666; width: 140px;">Registration ID:</td>
                  <td style="padding: 6px 0; color: #333; font-family: monospace; font-size: 11px;">${registrationData.registrationId || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #666;">Full Name:</td>
                  <td style="padding: 6px 0; color: #333;">${getFullName(registrationData)}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #666;">Email:</td>
                  <td style="padding: 6px 0; color: #333;">${getEmail(registrationData)}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #666;">Phone:</td>
                  <td style="padding: 6px 0; color: #333;">${getPhone(registrationData)}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #666;">Country:</td>
                  <td style="padding: 6px 0; color: #333;">${getCountry(registrationData)}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #666;">Address:</td>
                  <td style="padding: 6px 0; color: #333;">${getAddress(registrationData)}</td>
                </tr>
                ${getRegistrationTypeDisplay(registrationData) ? `
                <tr>
                  <td style="padding: 6px 0; color: #666;">Registration Type:</td>
                  <td style="padding: 6px 0; color: #333;">${getRegistrationTypeDisplay(registrationData)}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding: 6px 0; color: #666;">Number of Participants:</td>
                  <td style="padding: 6px 0; color: #333;">${String(registrationData.numberOfParticipants || 1)}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #666;">Number of Accompanying Persons:</td>
                  <td style="padding: 6px 0; color: #333;">${String(registrationData.numberOfAccompanyingPersons || 0)}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #666;">Accommodation Type:</td>
                  <td style="padding: 6px 0; color: #333;">${registrationData.accommodationType || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #666;">Accommodation Nights:</td>
                  <td style="padding: 6px 0; color: #333;">${String(registrationData.accommodationNights || 0)}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #666;">Check-In Date:</td>
                  <td style="padding: 6px 0; color: #333;">${registrationData.checkInDate || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #666;">Check-Out Date:</td>
                  <td style="padding: 6px 0; color: #333;">${registrationData.checkOutDate || 'N/A'}</td>
              </table>
            </div>
            
            <!-- Payment Summary -->
            <div style="padding: 0 20px 20px 20px;">
              <h3 style="color: ${BRAND_COLORS.blueAccent}; font-size: 16px; margin: 0 0 15px 0; font-weight: bold;">Payment Summary</h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <tr>
                  <td style="padding: 6px 0; color: #666; width: 140px;">Registration Fee:</td>
                  <td style="padding: 6px 0; color: #333;">${paymentData.currency || 'USD'} ${paymentData.amount || '0.00'}</td>
                </tr>
                <tr style="border-top: 1px solid #ddd;">
                  <td style="padding: 10px 0 6px 0; color: #666; font-weight: bold;">Total Amount:</td>
                  <td style="padding: 10px 0 6px 0; color: #333; font-weight: bold; font-size: 14px;">${paymentData.currency || 'USD'} ${paymentData.amount || '0.00'}</td>
                </tr>
              </table>
            </div>
            
            <!-- Contact Information -->
            <div style="padding: 0 20px 30px 20px;">
              <h3 style="color: ${BRAND_COLORS.blueAccent}; font-size: 14px; margin: 0 0 15px 0; font-weight: bold;">Contact Information</h3>

              <!-- Contact Email -->
              <p style="margin: 0 0 25px 0; font-size: 12px; color: ${BRAND_COLORS.darkGray};">
                Email: <a href="mailto:${receiptSettings.contactInformation?.supportEmail || 'contactus@intelliglobalconferences.com'}" style="color: ${BRAND_COLORS.blueAccent};">${receiptSettings.contactInformation?.supportEmail || 'contactus@intelliglobalconferences.com'}</a>
              </p>

              <!-- Copyright - Separate line -->
              <p style="margin: 0 0 8px 0; font-size: 10px; color: #666;">
                © 2025 ${receiptSettings.conferenceTitle || 'International Nursing Conference 2025'}
              </p>

              <!-- Generation Date - Separate line -->
              <p style="margin: 0; font-size: 10px; color: #999;">
                Generated on: ${new Date().toLocaleString()}
              </p>
            </div>

            <!-- Footer (now empty/minimal) -->
            <div style="background-color: #f8f9fa; padding: 10px 20px; text-align: center; border-top: 1px solid #dee2e6;">
              <!-- Footer content moved above to contact section -->
            </div>
            
          </div>
          

          
        </body>
        </html>
      `,
      text: `
PAYMENT RECEIPT - ${receiptSettings.conferenceTitle || 'International Nursing Conference 2025'}

PAYMENT INFORMATION:
Transaction ID: ${paymentData.transactionId || 'N/A'}
Order ID: ${paymentData.orderId || 'N/A'}
Amount: ${paymentData.currency || 'USD'} ${paymentData.amount || '0.00'}
Payment Method: ${paymentData.paymentMethod || 'PayPal'}
Payment Date: ${paymentData.paymentDate || new Date().toLocaleString()}
Status: ${paymentData.status || 'Completed'}

REGISTRATION DETAILS:
Registration ID: ${registrationData.registrationId || 'N/A'}
Full Name: ${getFullName(registrationData)}
Email: ${getEmail(registrationData)}
Phone: ${getPhone(registrationData)}
Country: ${getCountry(registrationData)}
Address: ${getAddress(registrationData)}
${getRegistrationTypeDisplay(registrationData) ? `Registration Type: ${getRegistrationTypeDisplay(registrationData)}` : ''}
Number of Participants: ${String(registrationData.numberOfParticipants || 1)}
Number of Accompanying Persons: ${String(registrationData.numberOfAccompanyingPersons || 0)}
Accomodation Type: ${registrationData.accommodationType || 'N/A'}
Accommodation Nights: ${String(registrationData.accommodationNights || 0)}
Check-In Date: ${registrationData.checkInDate || 'N/A'}
Check-Out Date: ${registrationData.checkOutDate || 'N/A'}

PAYMENT SUMMARY:
Registration Fee: ${paymentData.currency || 'USD'} ${paymentData.amount || '0.00'}
Total Amount: ${paymentData.currency || 'USD'} ${paymentData.amount || '0.00'}

CONTACT INFORMATION:
Email: ${receiptSettings.contactInformation?.supportEmail || 'contactus@intelliglobalconferences.com'}

© 2025 ${receiptSettings.conferenceTitle || 'International Nursing Conference 2025'}
Generated on: ${new Date().toLocaleString()}
      `,
      attachments: pdfBuffer ? [
        {
          filename: `Payment_Receipt_${paymentData.transactionId || 'Receipt'}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        }
      ] : []
    };

    // Upload PDF to Sanity BEFORE email — persists regardless of email delivery outcome
    let pdfUploaded = false;
    let pdfAssetId = null;

    if (pdfBuffer && registrationData._id) {
      const filename = `receipt_${registrationData.registrationId || 'unknown'}_${Date.now()}.pdf`;
      const pdfAsset = await uploadPDFToSanity(pdfBuffer, filename);

      if (pdfAsset) {
        const updateSuccess = await updateRegistrationWithPDF(registrationData._id, pdfAsset);
        pdfUploaded = updateSuccess;
        pdfAssetId = pdfAsset._id;

        if (updateSuccess) {
          console.log(`✅ PDF receipt stored in Sanity for registration: ${registrationData._id}`);
        }
      }
    }

    const result = await transporter.sendMail(mailOptions);

    return {
      success: true,
      messageId: result.messageId,
      logoUsed: !!footerLogo,
      logoUrl: footerLogo?.url || null,
      pdfGenerated: !!pdfBuffer,
      pdfSize: pdfBuffer ? pdfBuffer.length : 0,
      pdfUploaded: pdfUploaded,
      pdfAssetId: pdfAssetId
    };

  } catch (error) {
    console.error('❌ Failed to send payment receipt email:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send payment receipt email with REAL dynamic data from PayPal and Sanity CMS
 * @param {Object} paymentData - REAL payment information from PayPal
 * @param {Object} registrationData - REAL registration information from Sanity
 * @param {string} recipientEmail - Email address to send receipt to
 */
async function sendPaymentReceiptEmailWithRealData(paymentData, registrationData, recipientEmail) {
  try {
    console.log('🚀 Sending payment receipt with REAL dynamic data...');

    // Enhanced validation and logging
    console.log('📋 Input validation:', {
      hasPaymentData: !!paymentData,
      hasRegistrationData: !!registrationData,
      hasRecipientEmail: !!recipientEmail,
      registrationId: registrationData?._id || registrationData?.registrationId,
      transactionId: paymentData?.transactionId
    });

    // Validate required data
    if (!paymentData || !registrationData || !recipientEmail) {
      throw new Error('Missing required data: paymentData, registrationData, or recipientEmail');
    }

    // Validate that we have real payment data (not test values)
    if (!paymentData.transactionId || paymentData.transactionId.includes('test') || paymentData.transactionId.includes('TEST')) {
      console.warn('⚠️  Warning: Payment data appears to be test data');
    }

    // Ensure registration data has required _id field for PDF storage
    if (!registrationData._id) {
      console.warn('⚠️  Warning: Registration data missing _id field - PDF storage may fail');
      console.log('📋 Available registration fields:', Object.keys(registrationData));
    }

    // Fetch dynamic content from Sanity CMS
    const { getReceiptSettings } = require('./unifiedReceiptGenerator');
    const [footerLogo, emailConfig, siteSettings, receiptSettings] = await Promise.all([
      getFooterLogo(),
      getEmailConfig(),
      getSiteSettings(),
      getReceiptSettings()
    ]);

    console.log('🎛️ Using dynamic receipt settings from Sanity:');
    console.log(`   📋 Conference Title: "${receiptSettings.conferenceTitle}"`);
    console.log(`   🏢 Company Name: "${receiptSettings.companyName}"`);
    console.log(`   📧 Sender Email: "${receiptSettings.emailSettings?.senderEmail}"`);
    console.log(`   🎨 Blue Header: ${receiptSettings.receiptTemplate?.useBlueHeader}`);

    // Generate PDF receipt with real data
    let pdfBuffer = null;
    try {
      pdfBuffer = await generateReceiptPDF(paymentData, registrationData, footerLogo);
      console.log('✅ PDF receipt generated successfully with real data');
    } catch (pdfError) {
      console.warn('⚠️  PDF generation failed, continuing with email only:', pdfError.message);
    }

    // Configure SMTP transporter with Coolify-optimized production settings
    const smtpConfig = {
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      auth: {
        user: emailConfig.user,
        pass: emailConfig.pass,
      },
      tls: {
        rejectUnauthorized: false,
        servername: emailConfig.host,
        ciphers: 'HIGH:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!SRP:!CAMELLIA'
      },
      connectionTimeout: 60000, // 60 seconds
      greetingTimeout: 30000,   // 30 seconds
      socketTimeout: 60000,     // 60 seconds
      pool: false,              // Disable connection pooling for Coolify
      maxConnections: 1,        // Single connection for container environments
      debug: process.env.NODE_ENV !== 'production', // Enable debug in development
      logger: process.env.NODE_ENV !== 'production'  // Enable logging in development
    };

    const transporter = nodemailer.createTransport(smtpConfig);

    // Verify SMTP connection before sending
    try {
      console.log('🔍 Verifying SMTP connection...');
      await transporter.verify();
      console.log('✅ SMTP connection verified successfully');
    } catch (verifyError) {
      console.error('❌ SMTP verification failed:', verifyError.message);
      console.error('📧 SMTP Config Debug:', {
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        user: smtpConfig.auth.user,
        hasPassword: !!smtpConfig.auth.pass
      });

      // Try alternative SMTP configuration for production
      if (process.env.NODE_ENV === 'production') {
        console.log('🔄 Trying alternative SMTP configuration for production...');
        const altConfig = {
          ...smtpConfig,
          port: 587,
          secure: false,
          tls: {
            rejectUnauthorized: false,
            starttls: true
          }
        };

        const altTransporter = nodemailer.createTransport(altConfig);
        try {
          await altTransporter.verify();
          console.log('✅ Alternative SMTP configuration verified');
          // Use alternative transporter
          Object.assign(transporter, altTransporter);
        } catch (altError) {
          console.error('❌ Alternative SMTP also failed:', altError.message);
          throw new Error(`SMTP configuration failed: ${verifyError.message}`);
        }
      } else {
        throw verifyError;
      }
    }

    console.log('📧 Using email configuration:', {
      host: emailConfig.host,
      port: emailConfig.port,
      user: emailConfig.user,
      fromEmail: emailConfig.fromEmail
    });

    const mailOptions = {
      from: `"${emailConfig.fromName}" <${emailConfig.fromEmail}>`,
      to: recipientEmail,
      subject: `✅ Payment Receipt - ${receiptSettings.conferenceTitle || 'International Nursing Conference 2025'}`,
      // Updated mailOptions.html in sendPaymentReceiptEmailWithRealData function:

      html: `
    <!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Receipt</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  
  <!-- Receipt Container -->
  <table style="width: 100%; max-width: 900px; margin: 0 auto; background-color: #ffffff; border-collapse: collapse;">
    
    <!-- Header with Navy Blue Branding -->
    <tr>
      <td colspan="2" style="background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); padding: 20px 30px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            ${footerLogo ? `
              <td style="text-align: left; vertical-align: middle;">
                <img src="${footerLogo.url}" alt="${footerLogo.alt}" style="height: 50px; max-width: 280px; border: none; display: block;" />
              </td>
            ` : `
              <td style="text-align: left; vertical-align: middle;">
                <div style="color: white; font-size: 20px; font-weight: 700;">Intelli Global Conferences</div>
              </td>
            `}
            <td style="text-align: right; vertical-align: middle;">
              <div style="color: white; font-size: 16px; font-weight: 700; letter-spacing: 0.5px;">PAYMENT RECEIPT</div>
              <div style="color: rgba(255,255,255,0.8); font-size: 12px; margin-top: 5px;">${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Conference Title Bar -->
    <tr>
      <td colspan="2" style="background: #f8f9fa; padding: 15px 30px; border-bottom: 1px solid #dee2e6;">
        <div style="font-size: 18px; font-weight: 700; color: #1a1a1a; margin: 0;">
          ${receiptSettings.conferenceTitle || 'Global summit on Traditional and Alternative Medicine 2026'}
        </div>
      </td>
    </tr>

    <!-- Two Column Content -->
    <tr>
      <td style="width: 50%; padding: 25px 30px; vertical-align: top; border-right: 1px solid #e5e5e5;">
        
        <!-- Payment Information -->
        <div style="margin-bottom: 25px;">
          <h3 style="color: #1e3a8a; font-size: 15px; font-weight: 700; margin: 0 0 15px 0; border-bottom: 2px solid #e0e0e0; padding-bottom: 8px;">
            Payment Information
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <tr>
              <td style="padding: 6px 0; color: #666; font-weight: 500;">Transaction ID:</td>
              <td style="padding: 6px 0; color: #1a1a1a; font-weight: 600;">${paymentData.transactionId || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #666; font-weight: 500;">Order ID:</td>
              <td style="padding: 6px 0; color: #1a1a1a; font-weight: 600;">${paymentData.orderId || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #666; font-weight: 500;">Payment Method:</td>
              <td style="padding: 6px 0; color: #1a1a1a; font-weight: 600;">${paymentData.paymentMethod || 'PayPal'}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #666; font-weight: 500;">Payment Date:</td>
              <td style="padding: 6px 0; color: #1a1a1a; font-weight: 600;">${paymentData.paymentDate || new Date().toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #666; font-weight: 500;">Status:</td>
              <td style="padding: 6px 0;">
                <span style="display: inline-block; background: #28a745; color: white; padding: 4px 12px; border-radius: 4px; font-size: 11px; font-weight: 700;">
                  ${paymentData.status || 'COMPLETED'}
                </span>
              </td>
            </tr>
          </table>
        </div>

      </td>

      <td style="width: 50%; padding: 25px 30px; vertical-align: top;">
        
        <!-- Registration Details -->
        <div style="margin-bottom: 25px;">
          <h3 style="color: #1e3a8a; font-size: 15px; font-weight: 700; margin: 0 0 15px 0; border-bottom: 2px solid #e0e0e0; padding-bottom: 8px;">
            Registration Details
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <tr>
              <td style="padding: 6px 0; color: #666; font-weight: 500;">Registration ID:</td>
              <td style="padding: 6px 0; color: #1a1a1a; font-weight: 600; font-family: monospace; font-size: 11px;">${registrationData.registrationId || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #666; font-weight: 500;">Full Name:</td>
              <td style="padding: 6px 0; color: #1a1a1a; font-weight: 600;">${getFullName(registrationData)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #666; font-weight: 500;">Email:</td>
              <td style="padding: 6px 0; color: #1e3a8a; font-weight: 600;">${getEmail(registrationData)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #666; font-weight: 500;">Phone:</td>
              <td style="padding: 6px 0; color: #1a1a1a; font-weight: 600;">${getPhone(registrationData)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #666; font-weight: 500;">Country:</td>
              <td style="padding: 6px 0; color: #1a1a1a; font-weight: 600;">${getCountry(registrationData)}</td>
            </tr>
          </table>
        </div>

      </td>
    </tr>

    <!-- Additional Information - Full Width -->
    <tr>
      <td colspan="2" style="padding: 25px 30px; border-top: 1px solid #e5e5e5;">
        <h3 style="color: #1e3a8a; font-size: 15px; font-weight: 700; margin: 0 0 15px 0; border-bottom: 2px solid #e0e0e0; padding-bottom: 8px;">
          Additional Information
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <tr>
            <td style="width: 50%; padding: 6px 15px 6px 0; vertical-align: top;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; color: #666; font-weight: 500; width: 180px;">Address:</td>
                  <td style="padding: 6px 0; color: #1a1a1a; font-weight: 600;">${getAddress(registrationData)}</td>
                </tr>
                ${getRegistrationTypeDisplay(registrationData) ? `
                <tr>
                  <td style="padding: 6px 0; color: #666; font-weight: 500;">Registration Type:</td>
                  <td style="padding: 6px 0; color: #1a1a1a; font-weight: 600;">${getRegistrationTypeDisplay(registrationData)}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding: 6px 0; color: #666; font-weight: 500;">Participants:</td>
                  <td style="padding: 6px 0; color: #1a1a1a; font-weight: 600;">${String(registrationData.numberOfParticipants || 1)}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #666; font-weight: 500;">Accompanying Persons:</td>
                  <td style="padding: 6px 0; color: #1a1a1a; font-weight: 600;">${String(registrationData.numberOfAccompanyingPersons || 0)}</td>
                </tr>
              </table>
            </td>
            <td style="width: 50%; padding: 6px 0 6px 15px; vertical-align: top; border-left: 1px solid #e5e5e5;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; color: #666; font-weight: 500; width: 180px;">Accommodation:</td>
                  <td style="padding: 6px 0; color: #1a1a1a; font-weight: 600;">${registrationData.accommodationType || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #666; font-weight: 500;">Nights:</td>
                  <td style="padding: 6px 0; color: #1a1a1a; font-weight: 600;">${String(registrationData.accommodationNights || 0)}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #666; font-weight: 500;">Check-In:</td>
                  <td style="padding: 6px 0; color: #1a1a1a; font-weight: 600;">${registrationData.checkInDate || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #666; font-weight: 500;">Check-Out:</td>
                  <td style="padding: 6px 0; color: #1a1a1a; font-weight: 600;">${registrationData.checkOutDate || 'N/A'}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Total Amount Bar -->
    <tr>
      <td colspan="2" style="padding: 0;">
        <table style="width: 100%; background-color: #1a2332; border-collapse: collapse; margin: 0;">
          <tr>
            <td style="padding: 22px 30px; width: 50%; vertical-align: middle;">
              <div style="color: #ffffff; font-size: 16px; font-weight: 700; letter-spacing: 0.5px;">
                TOTAL AMOUNT PAID
              </div>
            </td>
            <td style="padding: 22px 30px; width: 50%; vertical-align: middle; text-align: right;">
              <div style="color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: 0.3px;">
                ${paymentData.currency || 'USD'} ${paymentData.amount || '0.00'}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td colspan="2" style="background: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #dee2e6;">
        <div style="font-size: 11px; color: #333; margin-bottom: 5px;">
          <strong>Contact:</strong> 
          <a href="mailto:${receiptSettings.contactInformation?.supportEmail || 'contactus@intelliglobalconferences.com'}" 
             style="color: #1e3a8a; text-decoration: none;">
            ${receiptSettings.contactInformation?.supportEmail || 'contactus@intelliglobalconferences.com'}
          </a>
        </div>
      </td>
    </tr>

  </table>
  
</body>
</html>
    `,
      text: `
PAYMENT RECEIPT - ${receiptSettings.conferenceTitle || 'International Nursing Conference 2025'}

PAYMENT INFORMATION:
Transaction ID: ${paymentData.transactionId || 'N/A'}
Order ID: ${paymentData.orderId || 'N/A'}
Amount: ${paymentData.currency || 'USD'} ${paymentData.amount || '0.00'}
Payment Method: ${paymentData.paymentMethod || 'PayPal'}
Payment Date: ${paymentData.paymentDate || new Date().toLocaleString()}
Status: ${paymentData.status || 'Completed'}

REGISTRATION DETAILS:
Registration ID: ${registrationData.registrationId || 'N/A'}
Full Name: ${getFullName(registrationData)}
Email: ${getEmail(registrationData)}
Phone: ${getPhone(registrationData)}
Country: ${getCountry(registrationData)}
Address: ${getAddress(registrationData)}
${getRegistrationTypeDisplay(registrationData) ? `Registration Type: ${getRegistrationTypeDisplay(registrationData)}` : ''}
Number of Participants: ${String(registrationData.numberOfParticipants || 1)}
Number of Accompanying Persons: ${String(registrationData.numberOfAccompanyingPersons || 0)}
Accommodation Type: ${registrationData.accommodationType || 'N/A'}
Accommodation Nights: ${String(registrationData.accommodationNights || 0)}
Check-In Date: ${registrationData.checkInDate || 'N/A'}
Check-Out Date: ${registrationData.checkOutDate || 'N/A'}

CONTACT INFORMATION:
Email: ${emailConfig.fromEmail}

© 2025 ${receiptSettings.conferenceTitle || 'International Nursing Conference 2025'}
Generated on: ${new Date().toLocaleString()}
      `,
      attachments: pdfBuffer ? [
        {
          filename: `Payment_Receipt_${paymentData.transactionId || 'Receipt'}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        }
      ] : []
    };

    // Upload PDF to Sanity BEFORE email — persists regardless of email delivery outcome
    let pdfUploaded = false;
    let pdfAssetId = null;

    console.log('📤 Starting PDF upload to Sanity...');
    console.log('📋 PDF upload conditions:', {
      hasPdfBuffer: !!pdfBuffer,
      pdfBufferSize: pdfBuffer ? pdfBuffer.length : 0,
      hasRegistrationId: !!registrationData._id,
      registrationId: registrationData._id,
      hasSanityToken: !!process.env.SANITY_API_TOKEN
    });

    if (pdfBuffer && registrationData._id) {
      try {
        const filename = `receipt_${registrationData.registrationId || registrationData._id || 'unknown'}_${Date.now()}.pdf`;
        console.log(`📤 Uploading PDF: ${filename}`);

        const pdfAsset = await uploadPDFToSanity(pdfBuffer, filename);

        if (pdfAsset) {
          console.log(`✅ PDF uploaded successfully: ${pdfAsset._id}`);

          const updateSuccess = await updateRegistrationWithPDF(registrationData._id, pdfAsset);
          pdfUploaded = updateSuccess;
          pdfAssetId = pdfAsset._id;

          if (updateSuccess) {
            console.log(`✅ PDF receipt stored in Sanity for registration: ${registrationData._id}`);
          } else {
            console.error(`❌ Failed to link PDF to registration: ${registrationData._id}`);
          }
        } else {
          console.error('❌ PDF upload to Sanity failed');
        }
      } catch (pdfUploadError) {
        console.error('❌ PDF upload process failed:', pdfUploadError.message);
        console.error('📋 PDF upload error details:', {
          error: pdfUploadError.message,
          stack: pdfUploadError.stack,
          registrationId: registrationData._id,
          hasSanityToken: !!process.env.SANITY_API_TOKEN
        });
      }
    } else {
      const reasons = [];
      if (!pdfBuffer) reasons.push('No PDF buffer generated');
      if (!registrationData._id) reasons.push('Missing registration _id');
      console.warn(`⚠️  Skipping PDF upload: ${reasons.join(', ')}`);
    }

    const result = await transporter.sendMail(mailOptions);

    return {
      success: true,
      messageId: result.messageId,
      logoUsed: !!footerLogo,
      logoUrl: footerLogo?.url || null,
      pdfGenerated: !!pdfBuffer,
      pdfSize: pdfBuffer ? pdfBuffer.length : 0,
      pdfUploaded: pdfUploaded,
      pdfAssetId: pdfAssetId,
      emailConfig: {
        host: emailConfig.host,
        fromEmail: emailConfig.fromEmail
      }
    };

  } catch (error) {
    console.error('❌ Failed to send payment receipt email with real data:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * UNIFIED PDF GENERATION SERVICE
 * Ensures consistency across all PDF generation methods (email, print, download)
 */

/**
 * Determine registration type display based on registration category
 * @param {Object} registrationData - Registration information
 * @returns {string|null} - Registration type display string or null if none
 */
function getRegistrationTypeDisplay(registrationData) {
  // Check for sponsorship registration first
  if (registrationData.sponsorType) {
    return `Sponsorship - ${registrationData.sponsorType}`;
  }

  // Check for regular registration type
  if (registrationData.registrationType) {
    const regType = registrationData.registrationType.toLowerCase();
    if (regType === 'regular' || regType === 'standard' || regType === 'normal') {
      return 'Regular';
    }
    // For other registration types, display as-is with proper capitalization
    return registrationData.registrationType.charAt(0).toUpperCase() +
      registrationData.registrationType.slice(1).toLowerCase();
  }

  // No registration type information available
  return null;
}

/**
 * Generate PDF receipt with unified formatting
 * This is the SINGLE source of truth for all PDF generation
 * @param {Object} paymentData - Payment information
 * @param {Object} registrationData - Registration information
 * @param {Object} footerLogo - Logo data from Sanity (optional)
 * @returns {Buffer} PDF buffer
 */
async function generateUnifiedReceiptPDF(paymentData, registrationData, footerLogo = null) {
  // Use the unified blue header generator to ensure consistency
  const { generateBlueHeaderReceiptPDF } = require('./unifiedReceiptGenerator');

  console.log('🧾 Using UNIFIED blue header PDF generation system...');
  return await generateBlueHeaderReceiptPDF(paymentData, registrationData);
}

/**
 * Production-ready email configuration with environment variables and fallbacks
 */
function getProductionEmailConfig() {
  // Environment variable fallbacks for production deployment
  const config = {
    host: process.env.SMTP_HOST || 'smtp.hostinger.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_SECURE === 'true' || true,
    user: process.env.SMTP_USER || 'contactus@intelliglobalconferences.com',
    pass: process.env.SMTP_PASS || 'Muni@12345m', // Fallback for development
    fromEmail: process.env.EMAIL_FROM || process.env.SMTP_USER || 'contactus@intelliglobalconferences.com',
    fromName: process.env.EMAIL_FROM_NAME || 'Intelli Global Conferences'
  };

  // Log configuration status for debugging (without sensitive data)
  console.log('📧 Email Configuration Status:', {
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.user,
    fromEmail: config.fromEmail,
    fromName: config.fromName,
    passConfigured: !!config.pass,
    usingFallbacks: {
      host: !process.env.SMTP_HOST,
      port: !process.env.SMTP_PORT,
      user: !process.env.SMTP_USER,
      pass: !process.env.SMTP_PASS,
      fromEmail: !process.env.EMAIL_FROM,
      fromName: !process.env.EMAIL_FROM_NAME
    }
  });

  return config;
}

/**
 * Helper functions to extract data from registration object
 * These match the functions used in unifiedReceiptGenerator.js
 */
function getPhone(registrationData) {
  if (registrationData.phone) return registrationData.phone;
  if (registrationData.phoneNumber) return registrationData.phoneNumber;
  if (registrationData.personalDetails?.phone) return registrationData.personalDetails.phone;
  if (registrationData.personalDetails?.phoneNumber) return registrationData.personalDetails.phoneNumber;
  return 'N/A';
}

function getFullName(registrationData) {
  if (registrationData.fullName) return registrationData.fullName;
  if (registrationData.personalDetails?.fullName) return registrationData.personalDetails.fullName;

  const firstName = registrationData.firstName || registrationData.personalDetails?.firstName || '';
  const lastName = registrationData.lastName || registrationData.personalDetails?.lastName || '';
  const title = registrationData.title || registrationData.personalDetails?.title || '';

  if (firstName && lastName) {
    return title ? `${title} ${firstName} ${lastName}`.trim() : `${firstName} ${lastName}`.trim();
  }

  return firstName || lastName || 'N/A';
}

function getEmail(registrationData) {
  if (registrationData.email) return registrationData.email;
  if (registrationData.personalDetails?.email) return registrationData.personalDetails.email;
  return 'N/A';
}

function getCountry(registrationData) {
  if (registrationData.country) return registrationData.country;
  if (registrationData.personalDetails?.country) return registrationData.personalDetails.country;
  return 'N/A';
}

function getAddress(registrationData) {
  if (registrationData.address) return registrationData.address;
  if (registrationData.personalDetails?.address) return registrationData.personalDetails.address;
  if (registrationData.personalDetails?.fullPostalAddress) return registrationData.personalDetails.fullPostalAddress;
  return 'N/A';
}

module.exports = {
  sendPaymentReceiptEmail,
  sendPaymentReceiptEmailWithRealData,
  getFooterLogo,
  getSiteSettings,
  getEmailConfig,
  generateReceiptPDF,
  generateUnifiedReceiptPDF, // NEW: Unified PDF generation
  getProductionEmailConfig, // NEW: Production email config
  uploadPDFToSanity, // CRITICAL FIX: Export PDF upload function
  updateRegistrationWithPDF // CRITICAL FIX: Export PDF update function
};
