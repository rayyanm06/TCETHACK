import sharp from 'sharp';
import crypto from 'crypto';
import { Upload } from '../models/Upload.js';
import { uploadImage } from '../adapters/storage/index.js';
import { classifyImage } from '../adapters/vision/index.js';
import { signUploadToken, verifyUploadToken } from '../utils/token.js';
import { validateImage, fail } from '../utils/validation.js';
export async function storeEvidence(buffer, mime, userId, purpose = 'REPORT') {
  validateImage(buffer, mime);
  // Decode, orient and re-encode; remove EXIF (including GPS) and reject corrupt images.
  try { buffer = await sharp(buffer,{limitInputPixels:25000000}).rotate().resize({width:1800,height:1800,fit:'inside',withoutEnlargement:true}).jpeg({quality:85}).toBuffer(); mime = 'image/jpeg'; }
  catch { fail('The image could not be decoded. Choose a valid image under 25 megapixels.', 'INVALID_IMAGE'); }
  const [stored, ai] = await Promise.all([uploadImage(buffer, mime), purpose === 'REPORT' ? classifyImage(buffer, mime) : Promise.resolve(null)]);
  const upload = await Upload.create({userId: String(userId), publicId: stored.imagePublicId, imageUrl: stored.imageUrl, imageHash: crypto.createHash('sha256').update(buffer).digest('hex'), ai, purpose, expiresAt: new Date(Date.now()+30*60*1000)});
  return {...stored, uploadToken: signUploadToken(String(upload._id), userId), imageHash: upload.imageHash, ai};
}
export async function readEvidence(token, userId, purpose, claimKey) {
  const evidenceId = verifyUploadToken(token, userId);
  if (!evidenceId) fail('Photo upload expired. Please upload the photo again.', 'INVALID_TOKEN');
  const filter = {_id:evidenceId,userId:String(userId),purpose,expiresAt:{$gt:new Date()},$or:[{consumedByKey:{$exists:false}}, {consumedByKey:claimKey}]};
  const evidence = claimKey ? await Upload.findOneAndUpdate(filter,{$set:{consumedByKey:claimKey}},{new:true}).lean() : await Upload.findOne(filter).lean();
  if (!evidence) fail('Photo upload is not valid for this request.', 'INVALID_TOKEN');
  return {imageUrl: evidence.imageUrl, imagePublicId: evidence.publicId, imageHash: evidence.imageHash, ai: evidence.ai};
}
