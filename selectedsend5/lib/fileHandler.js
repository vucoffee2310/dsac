// FILE: selectedsend3/lib/fileHandler.js

export function handleFileSelect(event, onFileParsed) {
  const file = event.target.files[0];
  if (file) {
    file.text().then(text => {
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      onFileParsed(lines);
    });
  }
}