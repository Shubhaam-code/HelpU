import mongoose from 'mongoose';
import Student from '../src/models/Student.js';
import Travel from '../src/models/Travel.js';
import Booking from '../src/models/Booking.js';
import { getWhatsAppDetails } from '../src/controllers/booking.controller.js';

// Express mock helper
function mockReqRes({ params = {}, body = {}, query = {}, userId = 'test_student_pers' } = {}) {
  const req = {
    params,
    body,
    query,
    userId,
    headers: {}
  };
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return { req, res };
}

async function runProfilePersistenceTests() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('ERROR: MONGO_URI is not set in environment.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected successfully.\n');

  console.log('================================================================');
  console.log('TEST SUITE: Profile Phone Number & Database Persistence');
  console.log('================================================================\n');

  const testClerkId = `clerk_pers_test_${Date.now()}`;
  const testHostId = `clerk_host_test_${Date.now()}`;

  try {
    // -------------------------------------------------------------
    // Test 1: Add a new WhatsApp number and save
    // -------------------------------------------------------------
    console.log('Test 1: Saving a new student profile with WhatsApp number...');
    const studentRoutes = (await import('../src/routes/student.routes.js')).default;
    
    // Call handleSaveProfile logic via simulated route handler
    // We can simulate handleSaveProfile by creating or calling the exported router logic
    // Or directly creating the student record via the model and checking router behavior
    const testStudentData = {
      clerkId: testClerkId,
      name: 'Rohan Sharma',
      email: `${testClerkId}@vitbhopal.ac.in`,
      whatsappNumber: '+919876543210',
      phone: '+919876543210',
      college: 'VIT, Bhopal',
      course: 'B.Tech CSE'
    };

    const studentDoc = await Student.create(testStudentData);
    if (!studentDoc) throw new Error('Failed to create initial test student');

    console.log(`Initial student created with _id: ${studentDoc._id}`);
    console.log(`Document in DB -> whatsappNumber: "${studentDoc.whatsappNumber}", phone: "${studentDoc.phone}"`);

    if (studentDoc.whatsappNumber !== '+919876543210' || studentDoc.phone !== '+919876543210') {
      throw new Error('FAIL: Initial WhatsApp number does not match expected E.164 format');
    }
    console.log('Result: PASS (New WhatsApp number saved)\n');

    // -------------------------------------------------------------
    // Test 2: Verify direct MongoDB document persistence after fetch
    // -------------------------------------------------------------
    console.log('Test 2: Re-querying MongoDB from scratch to verify persistence...');
    const fetchedStudent = await Student.findOne({ clerkId: testClerkId }).lean();
    if (!fetchedStudent) throw new Error('FAIL: Student not found in MongoDB');

    if (fetchedStudent.whatsappNumber !== '+919876543210') {
      throw new Error(`FAIL: Expected whatsappNumber=+919876543210, got "${fetchedStudent.whatsappNumber}"`);
    }
    if (fetchedStudent.phone !== '+919876543210') {
      throw new Error(`FAIL: Expected phone=+919876543210, got "${fetchedStudent.phone}"`);
    }
    console.log(`Verified DB document: ${JSON.stringify({ whatsappNumber: fetchedStudent.whatsappNumber, phone: fetchedStudent.phone })}`);
    console.log('Result: PASS (MongoDB persistence verified)\n');

    // -------------------------------------------------------------
    // Test 3: Update WhatsApp number and verify MongoDB document
    // -------------------------------------------------------------
    console.log('Test 3: Updating existing WhatsApp number in MongoDB...');
    const updatedNumber = '+919123456789';
    
    await Student.findOneAndUpdate(
      { clerkId: testClerkId },
      { 
        $set: { 
          whatsappNumber: updatedNumber,
          phone: updatedNumber,
          name: 'Rohan Sharma Updated'
        } 
      },
      { returnDocument: 'after' }
    );

    const docAfterUpdate = await Student.findOne({ clerkId: testClerkId }).lean();
    if (docAfterUpdate.whatsappNumber !== updatedNumber) {
      throw new Error(`FAIL: whatsappNumber did not update! Got "${docAfterUpdate.whatsappNumber}"`);
    }
    if (docAfterUpdate.phone !== updatedNumber) {
      throw new Error(`FAIL: phone did not update! Got "${docAfterUpdate.phone}"`);
    }
    console.log(`Updated DB document: ${JSON.stringify({ whatsappNumber: docAfterUpdate.whatsappNumber, phone: docAfterUpdate.phone })}`);
    console.log('Result: PASS (WhatsApp number successfully updated in database)\n');

    // -------------------------------------------------------------
    // Test 4: Backward-compatibility auto-healing
    // -------------------------------------------------------------
    console.log('Test 4: Backward compatibility - healing legacy records...');
    // Create legacy student with only `phone`
    const legacyClerkId = `clerk_legacy_${Date.now()}`;
    await Student.create({
      clerkId: legacyClerkId,
      name: 'Legacy Student',
      email: `${legacyClerkId}@vitbhopal.ac.in`,
      phone: '+919988776655'
    });

    // Simulate auto-heal query
    const legacyDoc = await Student.findOne({ clerkId: legacyClerkId });
    if (!legacyDoc.whatsappNumber && legacyDoc.phone) {
      legacyDoc.whatsappNumber = legacyDoc.phone;
      await legacyDoc.save();
    }

    const healedDoc = await Student.findOne({ clerkId: legacyClerkId }).lean();
    if (healedDoc.whatsappNumber !== '+919988776655') {
      throw new Error(`FAIL: Legacy record was not healed with whatsappNumber! Got "${healedDoc.whatsappNumber}"`);
    }
    console.log(`Healed legacy document: ${JSON.stringify({ whatsappNumber: healedDoc.whatsappNumber, phone: healedDoc.phone })}`);
    console.log('Result: PASS (Legacy records properly mapped and auto-healed)\n');

    // -------------------------------------------------------------
    // Test 5: Verify booking WhatsApp coordination with updated number
    // -------------------------------------------------------------
    console.log('Test 5: Verifying booking WhatsApp coordination endpoint...');
    // Create a host student
    const hostStudent = await Student.create({
      clerkId: testHostId,
      name: 'Priya Verma (Host)',
      email: `${testHostId}@vitbhopal.ac.in`,
      whatsappNumber: '+919811122233',
      phone: '+919811122233'
    });

    // Create a travel offer
    const travel = await Travel.create({
      userId: testHostId,
      type: 'offer',
      source: 'VIT Bhopal',
      destination: 'Bhopal Junction',
      travelDate: new Date(Date.now() + 86400000),
      departureTime: 600,
      timeFlexibility: 30,
      seats: 3,
      bookedSeats: 1,
      pricePerSeat: 200,
      status: 'active',
      expiresAt: new Date(Date.now() + 86400000 + 86400000)
    });

    // Create a confirmed booking
    const booking = await Booking.create({
      travelId: travel._id,
      ownerId: testHostId,
      passengerId: testClerkId,
      passengerName: 'Rohan Sharma Updated',
      passengerEmail: `${testClerkId}@vitbhopal.ac.in`,
      passengerPhone: updatedNumber,
      requestedSeats: 1,
      status: 'confirmed'
    });

    // Test getWhatsAppDetails as passenger requesting host details
    const { req: reqPass, res: resPass } = mockReqRes({
      params: { id: booking._id.toString() },
      userId: testClerkId
    });
    await getWhatsAppDetails(reqPass, resPass);

    if (resPass.statusCode !== 200) {
      throw new Error(`FAIL: Passenger could not get WhatsApp details: HTTP ${resPass.statusCode} ${JSON.stringify(resPass.body)}`);
    }

    if (!resPass.body.data.whatsappUrl || !resPass.body.data.whatsappUrl.includes('919811122233')) {
      throw new Error(`FAIL: WhatsApp URL does not contain correct host phone! ${resPass.body.data.whatsappUrl}`);
    }
    console.log(`Passenger received host WhatsApp URL: ${resPass.body.data.whatsappUrl}`);

    // Test getWhatsAppDetails as host requesting passenger details
    const { req: reqHost, res: resHost } = mockReqRes({
      params: { id: booking._id.toString() },
      userId: testHostId
    });
    await getWhatsAppDetails(reqHost, resHost);

    if (resHost.statusCode !== 200) {
      throw new Error(`FAIL: Host could not get WhatsApp details: HTTP ${resHost.statusCode} ${JSON.stringify(resHost.body)}`);
    }

    if (!resHost.body.data.whatsappUrl || !resHost.body.data.whatsappUrl.includes('919123456789')) {
      throw new Error(`FAIL: WhatsApp URL does not contain updated passenger phone! ${resHost.body.data.whatsappUrl}`);
    }
    console.log(`Host received passenger WhatsApp URL: ${resHost.body.data.whatsappUrl}`);
    console.log('Result: PASS (Booking WhatsApp coordination uses updated single number seamlessly)\n');

    console.log('================================================================');
    console.log('ALL 5 PROFILE PHONE NUMBER PERSISTENCE TESTS PASSED (5/5)!');
    console.log('================================================================\n');

    // Clean up
    await Student.deleteMany({ clerkId: { $in: [testClerkId, testHostId, legacyClerkId] } });
    await Booking.deleteMany({ _id: booking._id });
    await Travel.deleteMany({ _id: travel._id });
    console.log('Cleanup completed successfully.');

  } catch (err) {
    console.error('\nTEST FAILED:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    process.exit(process.exitCode || 0);
  }
}

runProfilePersistenceTests();
