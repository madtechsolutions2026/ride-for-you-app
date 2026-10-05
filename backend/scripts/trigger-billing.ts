import { runNightlyBilling, runCollectionsSweep } from '../src/services/collections';
import { runBookingExpirySweep } from '../src/services/weeklyBilling';

async function main() {
    console.log('--- STARTING MANUAL BILLING SWEEP ---');
    
    console.log('\n1. Running Booking Expiry Sweep...');
    const holds = await runBookingExpirySweep();
    console.log('-> Expired: ' + holds.expired + ', Warned: ' + holds.warned);
    
    console.log('\n2. Running Nightly Billing (Invoice Generation)...');
    const billing = await runNightlyBilling();
    console.log('-> Invoices Raised: ' + billing.raised + ', Reminders Sent: ' + billing.notified);
    
    console.log('\n3. Running Collections Sweep (Overdue Chasing)...');
    const collections = await runCollectionsSweep();
    console.log('-> Chased: ' + collections.chased + ', Final Warnings: ' + collections.finalWarnings + ', Recoveries Raised: ' + collections.recoveriesRaised);
    
    console.log('\n--- MANUAL BILLING SWEEP COMPLETE ---');
    process.exit(0);
}

main().catch(e => {
    console.error('Fatal error during manual sweep:', e);
    process.exit(1);
});
