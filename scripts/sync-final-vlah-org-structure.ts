import { syncVlahOrgTemplate } from "../src/server/org-template-vlah";

async function main() {
  const result = await syncVlahOrgTemplate();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
