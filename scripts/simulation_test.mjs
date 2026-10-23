import fs from 'node:fs';
import {verifySimulation} from './simulation_checks.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../public/data/campus.json',import.meta.url),'utf8'));
const report=verifySimulation(data);
console.log(JSON.stringify(report,null,2));
if(!report.pass)process.exitCode=1;
