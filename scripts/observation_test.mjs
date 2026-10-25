import fs from 'node:fs';
import {verifyObservation} from './observation_checks.mjs';

const data=JSON.parse(fs.readFileSync(new URL('../public/data/campus.json',import.meta.url),'utf8'));
const report=verifyObservation(data);
const json=JSON.stringify(report,null,2);
console.log(json);
const output=process.argv.indexOf('--output');
if(output>=0&&process.argv[output+1])fs.writeFileSync(process.argv[output+1],json+'\n');
if(!report.pass)process.exitCode=1;
