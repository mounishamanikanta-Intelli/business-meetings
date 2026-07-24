import { NextRequest, NextResponse } from 'next/server'
import { writeClient, client } from '../../sanity/client'
import crypto from "crypto";

async function hashFile(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return crypto.createHash("sha1").update(buffer).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting abstract submission...')
    const formData = await request.formData()

    // Extract form fields
    const title = formData.get('title') as string
    const firstName = formData.get('firstName') as string
    const lastName = formData.get('lastName') as string
    const email = formData.get('email') as string
    const phoneNumber = formData.get('phoneNumber') as string
    const country = formData.get('country') as string
    const organization = formData.get('organization') as string
    const interestedIn = formData.get('interestedIn') as string
    const trackName = formData.get('trackName') as string
    const abstractTitle = formData.get('abstractTitle') as string
    const abstractFile = formData.get('abstractFile') as File

    console.log('📝 Form data extracted:', {
      title, firstName, lastName, email, country, interestedIn, trackName, abstractTitle,
      fileSize: abstractFile?.size,
      fileType: abstractFile?.type
    })

    // Validate required fields
    if (!title || !firstName || !lastName || !email || !phoneNumber || !country || !organization ||
        !interestedIn || !trackName || !abstractTitle || !abstractFile) {
      console.log('❌ Validation failed: Missing required fields')
      return NextResponse.json(
        { error: 'All fields are required including title and organization' },
        { status: 400 }
      )
    }

    // Validate file type with proper MIME types
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]

    const allowedExtensions = ['.pdf', '.doc', '.docx']
    const fileExtension = abstractFile.name.toLowerCase().substring(abstractFile.name.lastIndexOf('.'))

    if (!allowedMimeTypes.includes(abstractFile.type) && !allowedExtensions.includes(fileExtension)) {
      console.log('❌ Validation failed: Invalid file type:', {
        mimeType: abstractFile.type,
        extension: fileExtension,
        fileName: abstractFile.name
      })
      return NextResponse.json(
        { error: 'Only PDF, DOC, and DOCX files are allowed' },
        { status: 400 }
      )
    }

    let submission: any | null = null;

    // Try to upload file and update document
    try {
      console.log('📤 Uploading file to Sanity...')

      // Get the correct file extension
      const fileExtension = abstractFile.name.toLowerCase().substring(abstractFile.name.lastIndexOf('.'))
      const sanitizedFileName = `${firstName}_${lastName}_abstract${fileExtension}`

      console.log('📁 File details:', {
        originalName: abstractFile.name,
        mimeType: abstractFile.type,
        size: abstractFile.size,
        extension: fileExtension,
        sanitizedName: sanitizedFileName
      })

            const brochureSettingsFile = await writeClient.fetch(`
        *[_id == "brochureSettings"][0]{
          "assetId": pdfFile.asset._ref
        }
      `);

      const abstractSettingsFile = await writeClient.fetch(`
        *[_type == "abstractSettings"][0]{
          "templateAssetId": abstractTemplate.asset._ref
        }
      `);

      let brochureHash: string | null = null;
      let templateHash: string | null = null;

      if (brochureSettingsFile?.assetId) {
        brochureHash = await writeClient.fetch(
          `*[_id == $id][0].sha1hash`,
          { id: brochureSettingsFile.assetId }
        );
      }

      if (abstractSettingsFile?.templateAssetId) {
        templateHash = await writeClient.fetch(
          `*[_id == $id][0].sha1hash`,
          { id: abstractSettingsFile.templateAssetId }
        );
      }

      const uploadedHash = await hashFile(abstractFile);

      if (brochureHash && uploadedHash === brochureHash) {
        console.log('⚠️ Brochure PDF cannot be uploaded as an abstract file : ', brochureHash);
        return NextResponse.json(
          { error: "You cannot upload the brochure PDF as an abstract." },
          { status: 400 }
        );
      }

      if (templateHash && uploadedHash === templateHash) {
        console.log('⚠️ Brochure PDF cannot be uploaded as an abstract file : ', templateHash);
        return NextResponse.json(
          { error: "You cannot upload the sample abstract template as an abstract." },
          { status: 400 }
        );
      }


        const fileAsset = await writeClient.assets.upload('file', abstractFile, {
          filename: sanitizedFileName,
          contentType: abstractFile.type
        });

        console.log('💾 Creating submission document...')
        submission = await writeClient.create({
          _type: 'abstractSubmission',
          title,
          firstName,
          lastName,
          email,
          phoneNumber,
          country,
          organization,
          interestedIn,
          trackName,
          abstractTitle,
          submissionDate: new Date().toISOString(),
          status: 'pending',
          abstractFile: {
            _type: 'file',
            asset: {
              _type: 'reference',
              _ref: fileAsset._id
            }
          }
        })    
        console.log('✅ Submission updated with file : ', fileAsset._id);
    } catch (fileError) {
      console.error('⚠️ Submission failed please try again', fileError)
    }
    console.log('✅ Submission created successfully:', submission._id)

    return NextResponse.json({
      success: true,
      message: 'Abstract submitted successfully',
      submissionId: submission._id
    })

  } catch (error) {
    console.error('❌ Error submitting abstract:', error)
    return NextResponse.json(
      { error: `Failed to submit abstract: ${error.message}` },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const submissions = await client.fetch(`
      *[_type == "abstractSubmission"] | order(submissionDate desc) {
        _id,
        title,
        firstName,
        lastName,
        email,
        phoneNumber,
        country,
        organization,
        interestedIn,
        trackName,
        abstractTitle,
        abstractFile{
          asset->{
            url,
            originalFilename
          }
        },
        submissionDate,
        status,
        reviewNotes
      }
    `)

    return NextResponse.json(submissions)
  } catch (error) {
    console.error('Error fetching abstract submissions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch submissions' },
      { status: 500 }
    )
  }
}
