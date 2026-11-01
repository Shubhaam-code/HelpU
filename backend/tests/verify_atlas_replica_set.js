import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';

async function verifyAtlasReplicaSetAndTransaction() {
  const mongoUri = process.env.MONGO_URI;
  console.log('Connecting to MongoDB using URI from .env...');
  await mongoose.connect(mongoUri);

  const admin = mongoose.connection.db.admin();
  
  // 1. Run hello command
  console.log('\n--- 1. Verification of hello admin command ---');
  const helloResult = await admin.command({ hello: 1 });
  console.log('setName:', helloResult.setName);
  console.log('isWritablePrimary:', helloResult.isWritablePrimary);
  console.log('hosts:', helloResult.hosts);

  const buildInfo = await admin.command({ buildInfo: 1 });
  console.log('MongoDB Version:', buildInfo.version);

  if (!helloResult.setName) {
    throw new Error('FAILURE: Replica Set is not enabled on this MongoDB instance!');
  }
  console.log('>> Replica Set verification: PASS (setName: ' + helloResult.setName + ')');

  // 2. Perform Transaction Test
  console.log('\n--- 2. Multi-Document Transaction Test ---');
  const session = await mongoose.startSession();
  const testCollection = mongoose.connection.db.collection('_tx_verification_test');

  const testId = new mongoose.Types.ObjectId();
  const testDoc = {
    _id: testId,
    testField: 'campuspool_transaction_test',
    createdAt: new Date()
  };

  try {
    console.log('Starting session and transaction...');
    session.startTransaction();

    console.log('Inserting test document inside transaction...');
    await testCollection.insertOne(testDoc, { session });

    console.log('Committing transaction...');
    await session.commitTransaction();
    console.log('Transaction committed successfully.');

    // Verify document exists outside the session
    const fetchedDoc = await testCollection.findOne({ _id: testId });
    if (!fetchedDoc) {
      throw new Error('FAILURE: Document was not found after transaction commit!');
    }
    console.log('>> Document verification after commit: PASS (Found document: ' + fetchedDoc._id + ')');

    // Test Abort / Rollback behavior
    console.log('\nTesting transaction abort/rollback...');
    session.startTransaction();
    const abortId = new mongoose.Types.ObjectId();
    await testCollection.insertOne({ _id: abortId, testField: 'should_be_aborted' }, { session });
    await session.abortTransaction();

    const abortedDoc = await testCollection.findOne({ _id: abortId });
    if (abortedDoc) {
      throw new Error('FAILURE: Aborted document was unexpectedly found!');
    }
    console.log('>> Transaction abort verification: PASS (Aborted document not present)');

  } finally {
    // Clean up temporary test document
    await testCollection.deleteOne({ _id: testId });
    console.log('\nCleaned up temporary test document.');
    await session.endSession();
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }

  console.log('\n============================================================');
  console.log('ALL REPLICA SET AND TRANSACTION VERIFICATIONS PASSED 100%!');
  console.log('============================================================\n');
}

verifyAtlasReplicaSetAndTransaction().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
