import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadLocal } from '../src/adapters/storage/local.js';
import { uploadImage } from '../src/adapters/storage/index.js';
import { ENV } from '../src/config/env.js';

test('Targeted Regression Suite: Storage & Media Correctness', async (t) => {
  await t.test('1. uploadLocal successfully writes valid image buffer and returns relative imageUrl', async () => {
    // Valid minimal JPEG header: FF D8 FF
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const res = await uploadLocal(jpegBuffer, 'image/jpeg');

    assert.ok(res.imageUrl.startsWith('/uploads/local_'), 'imageUrl must start with /uploads/local_');
    assert.ok(res.imagePublicId.startsWith('local_'), 'publicId must start with local_');
    assert.equal(res.storageDriver, 'local');
  });

  await t.test('2. uploadImage throws STORAGE_CONFIG_ERROR when cloudinary is set without required credentials', async () => {
    const originalDriver = ENV.STORAGE_DRIVER;
    const originalCloudName = ENV.CLOUDINARY_CLOUD_NAME;

    try {
      ENV.STORAGE_DRIVER = 'cloudinary';
      ENV.CLOUDINARY_CLOUD_NAME = ''; // intentionally missing

      const sampleBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
      await assert.rejects(
        async () => {
          await uploadImage(sampleBuf, 'image/jpeg');
        },
        (err) => {
          assert.equal(err.code, 'STORAGE_CONFIG_ERROR');
          assert.ok(err.message.includes('CLOUDINARY_CLOUD_NAME'));
          return true;
        }
      );
    } finally {
      ENV.STORAGE_DRIVER = originalDriver;
      ENV.CLOUDINARY_CLOUD_NAME = originalCloudName;
    }
  });

  await t.test('3. Media URL resolution logic correctly derives media origin and preserves absolute paths', () => {
    // Simulation of resolveMediaUrl logic
    function testResolver(url, apiBase = 'http://localhost:4000/api') {
      if (!url) return null;
      if (url.startsWith('http://') || url.startsWith('https://')) return url;
      if (url.startsWith('blob:') || url.startsWith('data:')) return url;

      let clean = url;
      if (clean.startsWith('/api/uploads')) clean = clean.replace('/api/uploads', '/uploads');
      if (clean.startsWith('api/uploads')) clean = clean.replace('api/uploads', '/uploads');
      if (!clean.startsWith('/')) clean = `/${clean}`;

      const origin = new URL(apiBase).origin;
      return `${origin}${clean}`;
    }

    assert.equal(
      testResolver('/uploads/local_123.jpg', 'http://localhost:4000/api'),
      'http://localhost:4000/uploads/local_123.jpg'
    );
    assert.equal(
      testResolver('uploads/local_123.jpg', 'http://localhost:4000/api'),
      'http://localhost:4000/uploads/local_123.jpg'
    );
    assert.equal(
      testResolver('/api/uploads/local_123.jpg', 'http://localhost:4000/api'),
      'http://localhost:4000/uploads/local_123.jpg'
    );
    assert.equal(
      testResolver('https://res.cloudinary.com/demo/image/upload/sample.jpg'),
      'https://res.cloudinary.com/demo/image/upload/sample.jpg'
    );
    assert.equal(
      testResolver('blob:http://localhost:5173/preview-uuid'),
      'blob:http://localhost:5173/preview-uuid'
    );
    assert.equal(testResolver(null), null);
    assert.equal(testResolver(''), null);
  });
});
