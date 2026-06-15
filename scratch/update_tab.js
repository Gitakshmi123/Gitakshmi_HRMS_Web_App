const fs = require('fs');
const path = 'c:/Users/baldaniya nitesh/Desktop/GT_HRMS/GT_HRMS/client/src/components/HR/OfficialRecordsTab.jsx';
let content = fs.readFileSync(path, 'utf8');

const oldChunk = `                  const isPreset = DEFAULT_GRADES.includes(val);
                  if (isPreset) {
                    setGradeId?.('');
                    setGrade?.(val);
                  } else {
                    setGradeId?.(val);
                    const g = grades.find(x => x._id === val);
                    setGrade?.(g?.name || '');
                  }`.replace(/\r\n/g, '\n');

const newChunk = `                  const isPreset = DEFAULT_GRADES.includes(val);
                  let normalizedKey = val;
                  if (isPreset) {
                    setGradeId?.('');
                    setGrade?.(val);
                    normalizedKey = val.toUpperCase();
                  } else {
                    setGradeId?.(val);
                    const g = grades.find(x => x._id === val);
                    setGrade?.(g?.name || '');
                    normalizedKey = val;
                  }
                  
                  // Auto-fill Band if linked in Policies
                  const linkedBand = gradeToBandMap.get(normalizedKey);
                  if (linkedBand) {
                    // Try to match with DEFAULT_BANDS (e.g. "BAND A" -> "Band A")
                    const matchingDefault = DEFAULT_BANDS.find(b => b.toUpperCase() === linkedBand.toUpperCase());
                    if (matchingDefault) {
                      setBand?.(matchingDefault);
                      setShowCustomBand(false);
                    } else {
                      setBand?.(linkedBand);
                      setShowCustomBand(true);
                    }
                  }`.replace(/\r\n/g, '\n');

// Normalize content line endings for search
const normalizedContent = content.replace(/\r\n/g, '\n');

if (normalizedContent.includes(oldChunk)) {
    const updatedContent = normalizedContent.replace(oldChunk, newChunk);
    // Write back with original line endings if they were CRLF
    fs.writeFileSync(path, updatedContent.replace(/\n/g, '\r\n'));
    console.log('Successfully updated!');
} else {
    console.log('Chunk not found!');
}
