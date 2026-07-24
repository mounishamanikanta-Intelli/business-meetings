const { createClient } = require('next-sanity');

let jsPDF;
try {
  jsPDF = require('jspdf').jsPDF;
} catch (error) {
  console.warn('jsPDF not available:', error.message);
}

const sanityClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'zt8218vh',
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2023-05-03',
  useCdn: false,
  token: process.env.SANITY_API_TOKEN,
});

// ─────────────────────────────────────────────────────────────
// COLOUR PALETTE
// ─────────────────────────────────────────────────────────────
const C = {
  navy:      [13,  27,  62],
  navyMid:   [25,  55, 109],
  navyLight: [41,  98, 175],
  white:     [255, 255, 255],
  offWhite:  [250, 251, 253],
  labelGray: [100, 116, 139],
  bodyDark:  [15,  23,  42],
  border:    [214, 222, 235],
  green:     [22, 163,  74],
  totalBg:   [13,  27,  62],
  footerBg:  [244, 246, 250],
};

// ─────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────
async function generateBlueHeaderReceiptPDF(paymentData, registrationData, receiptSettings = null) {
  if (!jsPDF) throw new Error('jsPDF not available');

  if (!receiptSettings) receiptSettings = await getReceiptSettings();

  const doc  = new jsPDF({ unit: 'mm', format: 'a4' });
  const PW   = doc.internal.pageSize.getWidth();
  const PH   = doc.internal.pageSize.getHeight();
  const ML   = 14;
  const MR   = 14;
  const CW   = PW - ML - MR;

  const logoData = await getFooterLogo();
  await drawHeader(doc, PW, ML, MR, receiptSettings, paymentData, logoData);

  let y = 38;
  y = drawConferenceStripe(doc, y, PW, ML, MR, receiptSettings);
  y = drawTwoColumnBlock(doc, y, PW, ML, MR, CW, paymentData, registrationData);
  y = drawAdditionalDetails(doc, y, PW, ML, MR, CW, registrationData);

  const BOTTOM_RESERVED = 36;
  const totalBarY = PH - BOTTOM_RESERVED;
  const footerY   = totalBarY + 18;

  drawTotalBar(doc, totalBarY, PW, ML, MR, paymentData);
  drawFooter(doc, footerY, PW, PH, receiptSettings);

  return Buffer.from(doc.output('arraybuffer'));
}

// ─────────────────────────────────────────────────────────────
// SECTION RENDERERS
// ─────────────────────────────────────────────────────────────

async function drawHeader(doc, PW, ML, MR, receiptSettings, paymentData, logoData) {
  fillRect(doc, 0,  0, PW,  8, C.navy);
  fillRect(doc, 0,  8, PW, 12, C.navyMid);
  fillRect(doc, 0, 20, PW,  8, C.navy);

  let logoEmbedded = false;
  if (logoData?.url) {
    try {
      let logoUrl = logoData.url.split('?')[0];
      if (logoUrl.includes('cdn.sanity.io')) {
        logoUrl = `${logoUrl}?w=800&h=300&q=100&fit=max&fm=png`;
      }
      const res = await fetch(logoUrl);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        const b64 = Buffer.from(buf).toString('base64');
        const fmt = logoUrl.toLowerCase().includes('.jpg') || logoUrl.toLowerCase().includes('.jpeg') ? 'JPEG' : 'PNG';
        const logoW = 55;
        const logoH = 14;
        const logoY = (28 - logoH) / 2;
        doc.addImage(`data:image/${fmt.toLowerCase()};base64,${b64}`, fmt, ML, logoY, logoW, logoH);
        logoEmbedded = true;
        console.log('✅ Logo embedded in PDF header');
      }
    } catch (e) {
      console.error('❌ Logo embedding failed:', e.message);
    }
  }

  if (!logoEmbedded) {
    setFont(doc, 'helvetica', 'bold', 13, C.white);
    doc.text(receiptSettings.companyName || 'Intelli Global Conferences', ML, 16);
  }

  setFont(doc, 'helvetica', 'bold', 10, C.white);
  doc.text('PAYMENT RECEIPT', PW - MR, 13, { align: 'right' });

  const dateStr = formatDateShort(paymentData.clientDate || paymentData.paymentDate);
  setFont(doc, 'helvetica', 'normal', 7.5, [180, 200, 230]);
  doc.text(dateStr, PW - MR, 19, { align: 'right' });

  setDrawColor(doc, C.navyLight);
  doc.setLineWidth(0.6);
  doc.line(0, 28, PW, 28);
}

function drawConferenceStripe(doc, y, PW, ML, MR, receiptSettings) {
  fillRect(doc, 0, y, PW, 10, [235, 240, 250]);
  setFont(doc, 'helvetica', 'bold', 9.5, C.navyMid);
  doc.text(receiptSettings.conferenceTitle || 'International Cardiology Conference 2026', ML, y + 6.8);

  setFont(doc, 'helvetica', 'italic', 7.5, C.labelGray);
  doc.text('Official Receipt', PW - MR, y + 6.8, { align: 'right' });

  setDrawColor(doc, C.border);
  doc.setLineWidth(0.3);
  doc.line(0, y + 10, PW, y + 10);

  return y + 15;
}

function drawTwoColumnBlock(doc, y, PW, ML, MR, CW, paymentData, registrationData) {
  const colW  = (CW - 6) / 2;
  const leftX = ML;
  const rightX = ML + colW + 6;

  drawSectionTitle(doc, 'Payment Information', leftX, y, colW);
  drawSectionTitle(doc, 'Registrant Details', rightX, y, colW);
  y += 7;

  const paymentRows = [
    ['Transaction ID', paymentData.transactionId || 'N/A'],
    ['Order ID',       paymentData.orderId        || 'N/A'],
    ['Payment Method', paymentData.paymentMethod  || 'PayPal'],
    ['Payment Date',   formatDateShort(paymentData.clientDate || paymentData.paymentDate)],
    ['Status',         paymentData.status         || 'COMPLETED'],
  ];

  const registrantRows = [
    ['Registration ID', registrationData.registrationId || 'N/A'],
    ['Full Name',       getFullName(registrationData)],
    ['Email',           getEmail(registrationData)],
    ['Phone',           getPhone(registrationData)],
    ['Country',         getCountry(registrationData)],
  ];

  const leftEndY  = drawInfoRows(doc, paymentRows,    leftX,  y, colW);
  const rightEndY = drawInfoRows(doc, registrantRows, rightX, y, colW);

  const divX = ML + colW + 3;
  setDrawColor(doc, C.border);
  doc.setLineWidth(0.25);
  doc.line(divX, y - 2, divX, Math.max(leftEndY, rightEndY) + 2);

  return Math.max(leftEndY, rightEndY) + 8;
}

function drawAdditionalDetails(doc, y, PW, ML, MR, CW, registrationData) {
  drawSectionTitle(doc, 'Registration & Accommodation Details', ML, y, CW);
  y += 7;

  const rows = [
    ['Registration Type',    getRegistrationTypeDisplay(registrationData)],
    ['Postal Address',       getAddress(registrationData)],
    ['No. of Participants',  String(registrationData.numberOfParticipants || 1)],
    ['Accompanying Persons', String(registrationData.numberOfAccompanyingPersons || 0)],
    ['Accommodation Type',   registrationData.accommodationType || 'N/A'],
    ['No. of Nights',        String(registrationData.accommodationNights || 0)],
    ['Check-In Date',        registrationData.checkInDate  || 'N/A'],
    ['Check-Out Date',       registrationData.checkOutDate || 'N/A'],
  ];

  const LABEL_W  = 55;
  const ROW_PAD  = 2.5;
  const MIN_ROW_H = 8;

  rows.forEach(([label, value], i) => {
    setFont(doc, 'helvetica', 'normal', 8, C.bodyDark);
    const wrappedLines = doc.splitTextToSize(String(value), CW - LABEL_W - 4);
    const rowH = Math.max(MIN_ROW_H, wrappedLines.length * 4.8 + ROW_PAD * 2);

    if (i % 2 === 0) fillRect(doc, ML, y, CW, rowH, C.offWhite);

    setDrawColor(doc, C.border);
    doc.setLineWidth(0.15);
    doc.rect(ML, y, CW, rowH);

    fillRect(doc, ML, y, LABEL_W, rowH, [225, 232, 245]);

    setFont(doc, 'helvetica', 'bold', 7.8, C.navyMid);
    doc.text(label, ML + 3, y + rowH / 2 + 1.2);

    setDrawColor(doc, C.border);
    doc.setLineWidth(0.15);
    doc.line(ML + LABEL_W, y, ML + LABEL_W, y + rowH);

    setFont(doc, 'helvetica', 'normal', 8, C.bodyDark);
    doc.text(wrappedLines, ML + LABEL_W + 3, y + ROW_PAD + 4);

    y += rowH;
  });

  return y + 8;
}

function drawTotalBar(doc, y, PW, ML, MR, paymentData) {
  fillRect(doc, 0, y, PW, 18, C.totalBg);

  setFont(doc, 'helvetica', 'bold', 10, C.white);
  doc.text('TOTAL AMOUNT PAID', ML, y + 11.5);

  const amount = `${paymentData.currency || 'USD'}  ${Number(paymentData.amount || 0).toFixed(2)}`;
  setFont(doc, 'helvetica', 'bold', 15, [134, 239, 172]);
  doc.text(amount, PW - MR, y + 12, { align: 'right' });

  setDrawColor(doc, [180, 150, 60]);
  doc.setLineWidth(0.4);
  doc.line(0, y, PW, y);
}

function drawFooter(doc, y, PW, PH, receiptSettings) {
  fillRect(doc, 0, y, PW, PH - y, C.footerBg);

  setDrawColor(doc, C.border);
  doc.setLineWidth(0.25);
  doc.line(0, y, PW, y);

  const email = receiptSettings.contactInformation?.supportEmail || 'contactus@intelliglobalconferences.com';
  setFont(doc, 'helvetica', 'normal', 7.5, C.labelGray);
  doc.text(`For support: ${email}  •  This is an official payment receipt.`, PW / 2, y + 6, { align: 'center' });

  setFont(doc, 'helvetica', 'italic', 6.5, [180, 190, 210]);
  doc.text('Generated by Intelli Global Conference Management System', PW / 2, y + 11, { align: 'center' });
}

// ─────────────────────────────────────────────────────────────
// SHARED DRAWING HELPERS
// ─────────────────────────────────────────────────────────────

function drawInfoRows(doc, rows, x, y, colW) {
  const LABEL_W   = 34;
  const ROW_PAD   = 2.2;
  const MIN_ROW_H = 7.5;

  rows.forEach(([label, value], i) => {
    const valW = colW - LABEL_W - 4;
    setFont(doc, 'helvetica', 'normal', 7.8, C.bodyDark);
    const lines = doc.splitTextToSize(String(value), valW);
    const rowH  = Math.max(MIN_ROW_H, lines.length * 4.6 + ROW_PAD * 2);

    if (i % 2 === 0) fillRect(doc, x, y, colW, rowH, C.offWhite);

    setDrawColor(doc, C.border);
    doc.setLineWidth(0.15);
    doc.rect(x, y, colW, rowH);

    if (label === 'Status') {
      setFont(doc, 'helvetica', 'bold', 7.2, C.labelGray);
      doc.text(label, x + 2, y + rowH / 2 + 1);

      const bx = x + LABEL_W + 1;
      const bw = doc.getTextWidth(String(value)) + 6;
      fillRect(doc, bx, y + 1.5, bw, rowH - 3, C.green);
      setFont(doc, 'helvetica', 'bold', 7, C.white);
      doc.text(String(value), bx + 3, y + rowH / 2 + 1.2);
    } else {
      setFont(doc, 'helvetica', 'bold', 7.2, C.labelGray);
      doc.text(label, x + 2, y + ROW_PAD + 4);

      setFont(doc, 'helvetica', 'normal', 7.8, C.bodyDark);
      doc.text(lines, x + LABEL_W + 2, y + ROW_PAD + 4);
    }

    y += rowH;
  });

  return y;
}

function drawSectionTitle(doc, title, x, y, w) {
  fillRect(doc, x, y, 2.5, 5.5, C.navyLight);

  setFont(doc, 'helvetica', 'bold', 8.5, C.navyMid);
  doc.text(title.toUpperCase(), x + 5, y + 4.2);

  setDrawColor(doc, C.border);
  doc.setLineWidth(0.25);
  doc.line(x, y + 6, x + w, y + 6);
}

// ─────────────────────────────────────────────────────────────
// TINY UTILITIES
// ─────────────────────────────────────────────────────────────
function fillRect(doc, x, y, w, h, rgb) {
  doc.setFillColor(...rgb);
  doc.rect(x, y, w, h, 'F');
}

function setFont(doc, family, style, size, rgb) {
  doc.setFont(family, style);
  doc.setFontSize(size);
  doc.setTextColor(...rgb);
}

function setDrawColor(doc, rgb) {
  doc.setDrawColor(...rgb);
}

// ─────────────────────────────────────────────────────────────
// DATA HELPERS — handle both nested personalDetails.x and flat formats
// ─────────────────────────────────────────────────────────────
function getRegistrationTypeDisplay(r) {
  if (r.sponsorType)              return `Sponsorship – ${r.sponsorType}`;
  if (r.selectedRegistrationName) return r.selectedRegistrationName;
  if (r.registrationType)         return r.registrationType;
  if (r.selectedType?.name)       return r.selectedType.name;
  return 'Regular Registration';
}

function getFullName(r) {
  if (r.fullName) return r.fullName;
  const t = r.title       || r.personalDetails?.title       || '';
  const f = r.firstName   || r.personalDetails?.firstName   || '';
  const l = r.lastName    || r.personalDetails?.lastName    || '';
  return `${t} ${f} ${l}`.replace(/\s+/g, ' ').trim() || 'N/A';
}

function getEmail(r)   { return r.email   || r.personalDetails?.email   || 'N/A'; }
function getPhone(r)   { return r.phone   || r.phoneNumber || r.personalDetails?.phone || r.personalDetails?.phoneNumber || 'N/A'; }
function getCountry(r) { return r.country || r.personalDetails?.country || 'N/A'; }
function getAddress(r) {
  return r.fullPostalAddress || r.address
    || r.personalDetails?.fullPostalAddress || r.personalDetails?.address || 'N/A';
}

function formatDateShort(ds) {
  if (!ds) ds = new Date().toISOString();
  try {
    return new Date(ds).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: '2-digit',
    });
  } catch { return ds; }
}

// ─────────────────────────────────────────────────────────────
// SANITY HELPERS
// ─────────────────────────────────────────────────────────────
async function getReceiptSettings() {
  try {
    const query = `*[_type == "receiptSettings" && isActive == true][0]`;
    const settings = await sanityClient.fetch(query);
    return settings || getDefaultReceiptSettings();
  } catch (error) {
    console.error('❌ Error fetching receipt settings:', error);
    return getDefaultReceiptSettings();
  }
}

async function getFooterLogo() {
  try {
    const query = `*[_type == "siteSettings"][0]{
      footerContent{footerLogo{asset->{_id, url}, alt}},
      logo{asset->{_id, url}, alt}
    }`;
    const siteSettings = await sanityClient.fetch(query);

    if (siteSettings?.footerContent?.footerLogo?.asset?.url) {
      return {
        url: siteSettings.footerContent.footerLogo.asset.url,
        _id: siteSettings.footerContent.footerLogo.asset._id,
        alt: siteSettings.footerContent.footerLogo.alt || 'Logo',
      };
    }

    if (siteSettings?.logo?.asset?.url) {
      return {
        url: siteSettings.logo.asset.url,
        _id: siteSettings.logo.asset._id,
        alt: siteSettings.logo.alt || 'Logo',
      };
    }

    return null;
  } catch (error) {
    console.error('❌ Error fetching footer logo:', error);
    return null;
  }
}

function getDefaultReceiptSettings() {
  return {
    conferenceTitle: 'International Cardiology Conference 2026',
    companyName: 'Intelli Global Conferences',
    receiptTemplate: { useBlueHeader: true },
    contactInformation: {
      supportEmail: 'contactus@intelliglobalconferences.com',
    },
  };
}

module.exports = {
  generateBlueHeaderReceiptPDF,
  getReceiptSettings,
  getFooterLogo,
};
