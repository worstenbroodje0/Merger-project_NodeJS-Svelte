const { db, insertRole } = require("./index");

async function seed() {
  console.log("Seeding roles...");

  const editor = await insertRole({ name: "editor" });
  console.log("Created roles:", editor);
  console.log("Done.");
  process.exit(0);
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});