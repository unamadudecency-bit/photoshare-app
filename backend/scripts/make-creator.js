// Run with: node scripts/make-creator.js <email>
require('dotenv').config();
const { users } = require('../src/db');

(async () => {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node scripts/make-creator.js <email>');
    process.exit(1);
  }

  const { resources } = await users.items
    .query({
      query: 'SELECT * FROM c WHERE c.email = @e',
      parameters: [{ name: '@e', value: email }]
    })
    .fetchAll();

  if (!resources[0]) {
    console.error(`❌ User not found: ${email}`);
    process.exit(1);
  }

  const user = resources[0];
  user.role = 'creator';
  await users.item(user.id, user.id).replace(user);
  console.log(`${email} is now a creator`);
})();