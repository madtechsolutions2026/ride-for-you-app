import { runNightlyBilling } from '../src/services/collections';

async function main() {
    console.log('Starting runNightlyBilling...');
    const result = await runNightlyBilling();
    console.log('Result:', result);
    process.exit(0);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
