import { importVlahOrgTemplate } from "../src/server/org-template-vlah";

async function main() {
  const replaceExisting = process.argv.includes("--force");
  const result = await importVlahOrgTemplate({ replaceExisting });

  if (result.skippedExisting) {
    console.log("Org structure already exists. Nothing imported. Use --force to rebuild it.");
    return;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        replaceExisting,
        positionsCreated: result.positionsCreated,
        assignmentsCreated: result.assignmentsCreated,
        missingUsers: result.missingUsers
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
