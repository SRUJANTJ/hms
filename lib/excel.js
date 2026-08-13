// lib/excel.js
// Shared client-side helpers for Excel (.xlsx) import, export and
// sample-template generation. Used by the Students and Fees screens
// (Admin + Warden). All parsing happens in the browser with the
// `xlsx` (SheetJS) package - the parsed JSON rows are then posted to
// the normal API routes, so the server never has to handle file
// uploads directly.

import * as XLSX from 'xlsx';

/* ------------------------------------------------------------------ */
/* Generic helpers                                                     */
/* ------------------------------------------------------------------ */

function normalizeKey(key) {
  return String(key || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Builds a lookup so a raw excel header like "Roll No", "Roll_Number",
// "roll number" etc. all resolve to the canonical field key.
function buildAliasLookup(fieldDefs) {
  const lookup = {};

  fieldDefs.forEach((field) => {
    const aliases = [field.key, field.label, ...(field.aliases || [])];

    aliases.forEach((alias) => {
      lookup[normalizeKey(alias)] = field.key;
    });
  });

  return lookup;
}

function readWorkbookRows(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];

        if (!firstSheetName) {
          resolve([]);
          return;
        }

        const sheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, {
          defval: '',
          raw: false,
        });

        resolve(rows);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Could not read the file'));

    reader.readAsArrayBuffer(file);
  });
}

function normalizeRows(rawRows, fieldDefs) {
  const aliasLookup = buildAliasLookup(fieldDefs);

  return rawRows.map((rawRow) => {
    const normalized = {};

    Object.keys(rawRow).forEach((rawKey) => {
      const canonicalKey = aliasLookup[normalizeKey(rawKey)];

      if (canonicalKey) {
        const value = rawRow[rawKey];
        normalized[canonicalKey] =
          typeof value === 'string' ? value.trim() : value;
      }
    });

    return normalized;
  });
}

function downloadWorkbook(rows, headerLabels, sheetName, fileName) {
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: headerLabels,
  });

  worksheet['!cols'] = headerLabels.map((label) => ({
    wch: Math.max(14, label.length + 4),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, fileName);
}

/* ------------------------------------------------------------------ */
/* Students                                                            */
/* ------------------------------------------------------------------ */

export const STUDENT_IMPORT_FIELDS = [
  { key: 'name', label: 'Full Name', required: true },
  { key: 'email', label: 'Email', required: true },
  { key: 'password', label: 'Password', required: true, aliases: ['login password', 'initial password'] },
  { key: 'phone', label: 'Phone', aliases: ['mobile', 'phone number'] },
  { key: 'roll_number', label: 'Roll Number', aliases: ['roll no', 'rollno'] },
  { key: 'course', label: 'Course' },
  { key: 'year', label: 'Year' },
  { key: 'gender', label: 'Gender' },
  { key: 'dob', label: 'DOB (YYYY-MM-DD)', aliases: ['dob', 'date of birth'] },
  { key: 'address', label: 'Address' },
  { key: 'guardian_name', label: 'Guardian Name' },
  { key: 'guardian_phone', label: 'Guardian Phone' },
  { key: 'emergency_contact', label: 'Emergency Contact' },
  { key: 'block', label: 'Block (optional)', aliases: ['block'] },
  { key: 'room_number', label: 'Room Number (optional)', aliases: ['room', 'room no'] },
];

const STUDENT_TEMPLATE_EXAMPLE = {
  'Full Name': 'Asha Rao',
  Email: 'asha.rao@example.com',
  Password: 'ChangeMe@123',
  Phone: '9876543210',
  'Roll Number': 'CSE2026001',
  Course: 'B.Tech CSE',
  Year: '2nd Year',
  Gender: 'Female',
  'DOB (YYYY-MM-DD)': '2005-06-15',
  Address: '12 MG Road, Bengaluru',
  'Guardian Name': 'Ramesh Rao',
  'Guardian Phone': '9876500000',
  'Emergency Contact': '9876511111',
  'Block (optional)': 'A',
  'Room Number (optional)': '101',
};

export function downloadStudentsTemplate() {
  const headers = STUDENT_IMPORT_FIELDS.map((field) => field.label);
  downloadWorkbook(
    [STUDENT_TEMPLATE_EXAMPLE],
    headers,
    'Students',
    'student_bulk_upload_template.xlsx'
  );
}

export async function parseStudentsFile(file) {
  const rawRows = await readWorkbookRows(file);
  const normalized = normalizeRows(rawRows, STUDENT_IMPORT_FIELDS);

  // Drop fully blank rows (e.g. trailing empty lines in the sheet)
  return normalized.filter((row) =>
    Object.values(row).some((value) => String(value || '').trim() !== '')
  );
}

export function exportStudentsToExcel(students, fileName = 'students_export.xlsx') {
  const headers = [
    'Full Name',
    'Email',
    'Phone',
    'Roll Number',
    'Course',
    'Year',
    'Gender',
    'Block',
    'Room Number',
    'Status',
    'Guardian Name',
    'Guardian Phone',
    'Emergency Contact',
    'Check-in Date',
  ];

  const rows = students.map((student) => ({
    'Full Name': student.name || '',
    Email: student.email || '',
    Phone: student.phone || '',
    'Roll Number': student.roll_number || '',
    Course: student.course || '',
    Year: student.year || '',
    Gender: student.gender || '',
    Block: student.block || '',
    'Room Number': student.room_number || '',
    Status: student.status || '',
    'Guardian Name': student.guardian_name || '',
    'Guardian Phone': student.guardian_phone || '',
    'Emergency Contact': student.emergency_contact || '',
    'Check-in Date': student.check_in_date
      ? String(student.check_in_date).slice(0, 10)
      : '',
  }));

  downloadWorkbook(rows, headers, 'Students', fileName);
}

/* ------------------------------------------------------------------ */
/* Fees                                                                 */
/* ------------------------------------------------------------------ */

export const FEE_IMPORT_FIELDS = [
  { key: 'roll_number', label: 'Roll Number', required: true, aliases: ['roll no', 'rollno'] },
  { key: 'fee_type', label: 'Fee Type', aliases: ['type'] },
  { key: 'amount', label: 'Amount', required: true },
  { key: 'due_date', label: 'Due Date (YYYY-MM-DD)', required: true, aliases: ['due date'] },
  { key: 'status', label: 'Status (Pending/Paid/Overdue)', aliases: ['status'] },
  { key: 'remarks', label: 'Remarks' },
];

const FEE_TEMPLATE_EXAMPLE = {
  'Roll Number': 'CSE2026001',
  'Fee Type': 'Monthly Rent',
  Amount: '6500',
  'Due Date (YYYY-MM-DD)': '2026-09-05',
  'Status (Pending/Paid/Overdue)': 'Pending',
  Remarks: '',
};

export function downloadFeesTemplate() {
  const headers = FEE_IMPORT_FIELDS.map((field) => field.label);
  downloadWorkbook(
    [FEE_TEMPLATE_EXAMPLE],
    headers,
    'Fees',
    'fees_bulk_update_template.xlsx'
  );
}

export async function parseFeesFile(file) {
  const rawRows = await readWorkbookRows(file);
  const normalized = normalizeRows(rawRows, FEE_IMPORT_FIELDS);

  return normalized.filter((row) =>
    Object.values(row).some((value) => String(value || '').trim() !== '')
  );
}

export function exportFeesToExcel(fees, fileName = 'fees_export.xlsx') {
  const headers = [
    'Student Name',
    'Roll Number',
    'Fee Type',
    'Amount',
    'Due Date',
    'Paid Date',
    'Status',
    'Remarks',
  ];

  const rows = fees.map((fee) => ({
    'Student Name': fee.student_name || '',
    'Roll Number': fee.roll_number || '',
    'Fee Type': fee.fee_type || '',
    Amount: fee.amount || '',
    'Due Date': fee.due_date ? String(fee.due_date).slice(0, 10) : '',
    'Paid Date': fee.paid_date ? String(fee.paid_date).slice(0, 10) : '',
    Status: fee.status || '',
    Remarks: fee.remarks || '',
  }));

  downloadWorkbook(rows, headers, 'Fees', fileName);
}
