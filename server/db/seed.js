const { db, insertRole } = require("./index");

async function seed() {
  console.log("Seeding roles...");
  const user = await insertRole({ name: "user" });
  const admin = await insertRole({ name: "admin" });
  console.log("Created roles:", user, admin);
  console.log("Done.");
  process.exit(0);
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});