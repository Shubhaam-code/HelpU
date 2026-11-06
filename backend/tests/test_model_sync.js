import mongoose from 'mongoose';
import Student from '../src/models/Student.js';

async function testSync() {
  console.log('--- Testing Student Model Phone & WhatsApp Number Synchronization ---');
  console.log('Hooks pres:', Array.from(Student.schema.s.hooks._pres.keys()));
  console.log('Hooks posts:', Array.from(Student.schema.s.hooks._posts.keys()));

  // Test 1: New document instance with only whatsappNumber
  const s1 = new Student({ clerkId: 'c1', name: 'Test 1', email: 't1@vit.ac.in', whatsappNumber: '+919876543210' });
  s1.schema.s.hooks.execPre('save', s1, () => {});
  console.log('Test 1 (only whatsappNumber):', { phone: s1.phone, whatsappNumber: s1.whatsappNumber });
  if (s1.phone !== '+919876543210' || s1.whatsappNumber !== '+919876543210') {
    throw new Error('Test 1 failed: phone and whatsappNumber did not synchronize');
  }

  // Test 2: New document instance with only phone
  const s2 = new Student({ clerkId: 'c2', name: 'Test 2', email: 't2@vit.ac.in', phone: '+919123456789' });
  s2.schema.s.hooks.execPre('save', s2, () => {});
  console.log('Test 2 (only phone):', { phone: s2.phone, whatsappNumber: s2.whatsappNumber });
  if (s2.phone !== '+919123456789' || s2.whatsappNumber !== '+919123456789') {
    throw new Error('Test 2 failed: phone and whatsappNumber did not synchronize');
  }

  // Test 3: New document instance with no phone
  const s3 = new Student({ clerkId: 'c3', name: 'Test 3', email: 't3@vit.ac.in' });
  s3.schema.s.hooks.execPre('save', s3, () => {});
  console.log('Test 3 (blank number):', { phone: s3.phone, whatsappNumber: s3.whatsappNumber });
  if (s3.phone !== '' || s3.whatsappNumber !== '') {
    throw new Error('Test 3 failed: blank numbers did not default to empty string');
  }

  // Test 4: findOneAndUpdate with $set whatsappNumber
  const update1 = { $set: { whatsappNumber: '+919988776655' } };
  const query1 = Student.findOneAndUpdate({ clerkId: 'c_test4' }, update1);
  const fns = Student.schema.s.hooks._pres.get('findOneAndUpdate');
  for (const item of fns) {
    item.fn.call(query1);
  }
  const qUpdate1 = query1.getUpdate().$set;
  console.log('Test 4 (findOneAndUpdate getUpdate $set):', qUpdate1);
  if (qUpdate1.phone !== '+919988776655' || qUpdate1.whatsappNumber !== '+919988776655') {
    throw new Error('Test 4 failed');
  }

  // Test 5: findOneAndUpdate with $set phone
  const update2 = { $set: { phone: '+919877766655' } };
  const query2 = Student.findOneAndUpdate({ clerkId: 'c_test5' }, update2);
  for (const item of fns) {
    item.fn.call(query2);
  }
  const qUpdate2 = query2.getUpdate().$set;
  console.log('Test 5 (findOneAndUpdate getUpdate $set):', qUpdate2);
  if (qUpdate2.phone !== '+919877766655' || qUpdate2.whatsappNumber !== '+919877766655') {
    throw new Error('Test 5 failed');
  }

  // Test 6: post find hook auto-healing
  const rawDoc = { name: 'Legacy Student', phone: '+919000011111' };
  Student.schema.s.hooks.execPost('findOne', null, [rawDoc], () => {});
  console.log('Test 6 (post find hook healing):', rawDoc);
  if (rawDoc.whatsappNumber !== '+919000011111' || rawDoc.phone !== '+919000011111') {
    throw new Error('Test 6 failed');
  }

  console.log('\n>>> ALL 6 MODEL SYNCHRONIZATION TESTS PASSED PERFECTLY! <<<');
}

testSync().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
