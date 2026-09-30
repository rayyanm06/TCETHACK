import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import bcrypt from 'bcryptjs';

async function main() {
  const args = process.argv.slice(2);
  let email = '';
  let password = '';
  let name = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) email = args[i + 1];
    if (args[i] === '--password' && args[i + 1]) password = args[i + 1];
    if (args[i] === '--name' && args[i + 1]) name = args[i + 1];
  }

  if (!email || !password || !name) {
    console.error('Usage: node scripts/createOperator.js --name "Operator Name" --email "operator@domain.gov" --password "securepassword"');
    process.exit(1);
  }

  await connectDB();

  const normalized = email.toLowerCase().trim();
  const existing = await User.findOne({ email: normalized });
  if (existing) {
    if (existing.role === 'OPERATOR') {
      console.log(`[Admin] User ${normalized} is already an operator.`);
    } else {
      existing.role = 'OPERATOR';
      await existing.save();
      console.log(`[Admin] Promoted existing user ${normalized} to OPERATOR role.`);
    }
    await disconnectDB();
    return;
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const user = await User.create({
    name: name.trim(),
    email: normalized,
    passwordHash,
    role: 'OPERATOR',
    neighbourhoodLabel: 'Municipal Operational HQ',
  });

  console.log(`[Admin] Created operator account: ${user.name} (${user.email})`);
  await disconnectDB();
}

main().catch((err) => {
  console.error('[Admin] Error creating operator:', err);
  process.exit(1);
});
