/** Recomputes the evidence seal from a downloaded record. Printed on the evidence page and in the PDF. */
export const VERIFY_CMD = `python3 -c "import json,hashlib,sys; d=json.load(open(sys.argv[1])); print(hashlib.sha256(json.dumps(d['record'],sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()==d['sha256'])" kovrell-record.json`;
