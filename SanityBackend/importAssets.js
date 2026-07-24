	import { createClient } from '@sanity/client';
	import { existsSync, readFileSync, createReadStream } from 'fs';
	import { join } from 'path';
	import { createInterface } from 'readline';

	// ===== CONFIGURATION =====
	const CONFIG = {
	  projectId: 'jcafcqs8',
	  dataset: 'production',
	  token: 'skYTDy6PezxyCuJodRrkia4GMESGXT3o5bTjePts7lB3gTnGS9CsVu4XAC3iLaGpnT3aHxs79bgGOEnQ9QWISMEPOnrKvZ2tx4CkVkjAnYotU02ZApPQ4TgLewVaNu1OQ0CJEWgyYri4rFVghmGd7bJM2UamXVzVakrYrTSK53wePrX75qY3',
	  apiVersion: '2023-01-01',
	  useCdn: false,
	  
	  // Paths
	  inputFile: './backup-production-0721/production/data.ndjson',
	  imagesFolder: './backup-production-0721/production/images',
	  filesFolder: './backup-production-0721/production/files',
	  
	  // Import settings
	  batchSize: 50,
	  delayBetweenBatches: 300,
	  uploadDelay: 100,
	};

	// ===== CLIENT SETUP =====
	const client = createClient({
	  projectId: CONFIG.projectId,
	  dataset: CONFIG.dataset,
	  token: CONFIG.token,
	  apiVersion: CONFIG.apiVersion,
	  useCdn: CONFIG.useCdn,
	});

	// ===== TRACK UPLOADED ASSETS =====
	const assetCache = new Map();

	// ===== EXTRACT FILENAME AND FOLDER FROM _sanityAsset =====
	function extractAssetInfo(sanityAsset) {
	  // Format: "image@file://./images/FILENAME.jpg" or "file@file://./files/FILENAME.pdf"
	  let match = sanityAsset.match(/file:\/\/\.\/images\/(.+)$/);
	  if (match) return { filename: match[1], folder: CONFIG.imagesFolder, type: 'image' };
	  
	  match = sanityAsset.match(/file:\/\/\.\/files\/(.+)$/);
	  if (match) return { filename: match[1], folder: CONFIG.filesFolder, type: 'file' };
	  
	  return null;
	}

	// ===== DETERMINE ASSET TYPE FROM PREFIX =====
	function getAssetTypeFromPrefix(sanityAsset) {
	  if (sanityAsset.startsWith('image@')) return 'image';
	  if (sanityAsset.startsWith('file@')) return 'file';
	  return null;
	}

	// ===== UPLOAD ASSET (IMAGE OR FILE) AND RETURN ASSET ID =====
	async function uploadAsset(sanityAsset) {
	  // Check cache first
	  if (assetCache.has(sanityAsset)) {
		return assetCache.get(sanityAsset);
	  }

	  const assetInfo = extractAssetInfo(sanityAsset);
	  if (!assetInfo) {
		console.error(`   ⚠️  Could not extract asset info from: ${sanityAsset}`);
		return null;
	  }

	  const { filename, folder, type } = assetInfo;
	  const filePath = join(folder, filename);
	  
	  if (!existsSync(filePath)) {
		console.error(`   ❌ File not found: ${filePath}`);
		return null;
	  }

	  try {
		const emoji = type === 'image' ? '🖼️' : '📄';
		console.log(`   ${emoji} Uploading ${type}: ${filename}`);
		
		const fileBuffer = readFileSync(filePath);
		const uploadedAsset = await client.assets.upload(type, fileBuffer, {
		  filename: filename,
		});

		// Cache the result
		assetCache.set(sanityAsset, uploadedAsset._id);
		
		console.log(`   ✅ Uploaded as: ${uploadedAsset._id}`);
		
		// Delay to avoid rate limits
		await new Promise(resolve => setTimeout(resolve, CONFIG.uploadDelay));
		
		return uploadedAsset._id;
		
	  } catch (error) {
		console.error(`   ❌ Failed to upload ${filename}: ${error.message}`);
		return null;
	  }
	}

	// ===== PROCESS DOCUMENT AND UPLOAD ASSETS =====
	async function processDocument(doc) {
	  let modified = false;
	  
	  async function traverse(obj, parentKey = '') {
		if (!obj || typeof obj !== 'object') return obj;

		if (Array.isArray(obj)) {
		  const results = [];
		  for (let i = 0; i < obj.length; i++) {
			results.push(await traverse(obj[i], `${parentKey}[${i}]`));
		  }
		  return results;
		}

		// Check if this object has _sanityAsset (for both images and files)
		if (obj._sanityAsset && (obj._sanityAsset.startsWith('image@file://') || obj._sanityAsset.startsWith('file@file://'))) {
		  modified = true;
		  
		  const assetType = getAssetTypeFromPrefix(obj._sanityAsset);
		  const assetId = await uploadAsset(obj._sanityAsset);
		  
		  if (assetId) {
			// Convert to proper Sanity format based on type
			if (assetType === 'image') {
			  return {
				_type: 'image',
				_key: obj._key,
				asset: {
				  _type: 'reference',
				  _ref: assetId,
				},
				// Preserve other properties
				...(obj.hotspot && { hotspot: obj.hotspot }),
				...(obj.crop && { crop: obj.crop }),
				...(obj.alt && { alt: obj.alt }),
			  };
			} else if (assetType === 'file') {
			  return {
				_type: 'file',
				_key: obj._key,
				asset: {
				  _type: 'reference',
				  _ref: assetId,
				},
				// Preserve other properties
				...(obj.title && { title: obj.title }),
				...(obj.description && { description: obj.description }),
			  };
			}
		  } else {
			console.error(`   ⚠️  Failed to upload asset for ${parentKey}`);
			return obj;
		  }
		}

		// Recursively process object properties
		const updated = {};
		for (const [key, value] of Object.entries(obj)) {
		  updated[key] = await traverse(value, `${parentKey}.${key}`);
		}
		return updated;
	  }

	  const processed = await traverse(doc);
	  return { processed, modified };
	}

	// ===== IMPORT DOCUMENTS =====
	async function importDocuments() {
	  console.log('\n🚀 Starting import with _sanityAsset processing...');
	  console.log(`📁 Reading file: ${CONFIG.inputFile}\n`);
	  
	  if (!existsSync(CONFIG.inputFile)) {
		console.error(`❌ Error: File not found: ${CONFIG.inputFile}`);
		process.exit(1);
	  }

	  const fileStream = createReadStream(CONFIG.inputFile);
	  const rl = createInterface({
		input: fileStream,
		crlfDelay: Infinity,
	  });

	  let batch = [];
	  let totalCount = 0;
	  let successCount = 0;
	  let errorCount = 0;
	  let batchNumber = 0;

	  try {
		for await (const line of rl) {
		  if (!line.trim()) continue;

		  try {
			const doc = JSON.parse(line);
			
			console.log(`\n📄 Processing: ${doc._type} (${doc._id})`);
			
			// Process document and upload any assets
			const { processed, modified } = await processDocument(doc);
			
			if (modified) {
			  console.log(`   📎 Document has assets - processed`);
			}
			
			batch.push(processed);

			if (batch.length >= CONFIG.batchSize) {
			  batchNumber++;
			  console.log(`\n📦 Importing batch ${batchNumber} (${batch.length} documents)...`);
			  
			  const result = await importBatch(batch);
			  successCount += result.success;
			  errorCount += result.errors;
			  totalCount += batch.length;
			  
			  console.log(`✅ Success: ${result.success} | ❌ Errors: ${result.errors}`);
			  console.log(`📊 Total processed: ${totalCount}`);
			  
			  batch = [];
			  await new Promise(resolve => setTimeout(resolve, CONFIG.delayBetweenBatches));
			}
		  } catch (parseError) {
			console.error(`⚠️  Failed to parse line: ${parseError.message}`);
			errorCount++;
		  }
		}

		// Import remaining documents
		if (batch.length > 0) {
		  batchNumber++;
		  console.log(`\n📦 Importing final batch ${batchNumber} (${batch.length} documents)...`);
		  
		  const result = await importBatch(batch);
		  successCount += result.success;
		  errorCount += result.errors;
		  totalCount += batch.length;
		  
		  console.log(`✅ Success: ${result.success} | ❌ Errors: ${result.errors}`);
		}

		console.log('\n' + '='.repeat(60));
		console.log('🎉 Import completed!');
		console.log(`📎 Total unique assets uploaded: ${assetCache.size}`);
		console.log(`📊 Total documents imported: ${totalCount}`);
		console.log(`✅ Successfully imported: ${successCount}`);
		console.log(`❌ Failed: ${errorCount}`);
		console.log('='.repeat(60));

	  } catch (error) {
		console.error('\n❌ Fatal error during import:', error);
	  } finally {
		fileStream.close();
		rl.close();
	  }
	}

	// ===== BATCH IMPORT FUNCTION =====
	async function importBatch(documents) {
	  let success = 0;
	  let errors = 0;

	  try {
		const transaction = client.transaction();
		
		documents.forEach(doc => {
		  transaction.createOrReplace(doc);
		});

		await transaction.commit();
		success = documents.length;
		
	  } catch (error) {
		console.error(`❌ Batch import error: ${error.message}`);
		
		console.log('🔄 Attempting individual document import...');
		
		for (const doc of documents) {
		  try {
			await client.createOrReplace(doc);
			success++;
		  } catch (docError) {
			console.error(`❌ Failed to import document ${doc._id}: ${docError.message}`);
			errors++;
		  }
		}
	  }

	  return { success, errors };
	}

	// ===== VALIDATION =====
	function validateConfig() {
	  const errors = [];
	  
	  if (!CONFIG.projectId || CONFIG.projectId === 'YOUR_PROJECT_ID') {
		errors.push('projectId is not set');
	  }
	  if (!CONFIG.token || CONFIG.token === 'YOUR_API_TOKEN') {
		errors.push('token is not set');
	  }
	  if (!CONFIG.dataset) {
		errors.push('dataset is not set');
	  }
	  if (!existsSync(CONFIG.imagesFolder)) {
		errors.push(`images folder not found: ${CONFIG.imagesFolder}`);
	  }
	  
	  // Files folder is optional - just warn if not found
	  if (!existsSync(CONFIG.filesFolder)) {
		console.warn(`⚠️  Warning: files folder not found: ${CONFIG.filesFolder}`);
		console.warn(`   If you have PDFs or other files, they will not be uploaded.\n`);
	  }
	  
	  if (errors.length > 0) {
		console.error('❌ Configuration errors:');
		errors.forEach(err => console.error(`   - ${err}`));
		console.error('\n💡 Please update the CONFIG object at the top of this script.');
		process.exit(1);
	  }
	}

	// ===== MAIN =====
	validateConfig();
	importDocuments().catch(error => {
	  console.error('❌ Unhandled error:', error);
	  process.exit(1);
	});