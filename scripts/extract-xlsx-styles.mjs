import fs from "node:fs/promises";
import path from "node:path";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import JSZip from "jszip";

const XLSX_URL = "https://docs.google.com/spreadsheets/d/19Xs3TScHhS369n_A8VvUGxszoxncx1p32T8iwNHSKTU/export?format=xlsx";
const TEMP_XLSX_PATH = path.join(process.cwd(), "scripts/temp_sheet.xlsx");

async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download: ${res.statusText}`);
  const fileStream = createWriteStream(destPath);
  await pipeline(res.body, fileStream);
}

async function main() {
  try {
    console.log("Downloading Excel export of the spreadsheet...");
    await downloadFile(XLSX_URL, TEMP_XLSX_PATH);
    console.log("Downloaded successfully to", TEMP_XLSX_PATH);
    
    const buffer = await fs.readFile(TEMP_XLSX_PATH);
    const zip = await JSZip.loadAsync(buffer);
    
    console.log("XLSX contents:");
    const files = Object.keys(zip.files);
    console.log("Found", files.length, "files inside the XLSX zip.");
    
    // Read xl/styles.xml
    const stylesXmlEntry = zip.files["xl/styles.xml"];
    if (stylesXmlEntry) {
      const stylesXml = await stylesXmlEntry.async("string");
      console.log("xl/styles.xml length:", stylesXml.length);
      await fs.writeFile(path.join(process.cwd(), "scripts/temp_styles.xml"), stylesXml, "utf8");
      console.log("Wrote styles XML to scripts/temp_styles.xml for inspection.");
    }
    
    // Read xl/worksheets/sheet1.xml (ROS by TIME)
    const sheet1XmlEntry = zip.files["xl/worksheets/sheet1.xml"];
    if (sheet1XmlEntry) {
      const sheet1Xml = await sheet1XmlEntry.async("string");
      console.log("xl/worksheets/sheet1.xml length:", sheet1Xml.length);
      await fs.writeFile(path.join(process.cwd(), "scripts/temp_sheet1.xml"), sheet1Xml, "utf8");
      console.log("Wrote sheet1 XML to scripts/temp_sheet1.xml for inspection.");
    }
    
  } catch (err) {
    console.error("Error:", err);
  } finally {
    // Clean up xlsx file
    try {
      await fs.unlink(TEMP_XLSX_PATH);
    } catch {}
  }
}

main();
