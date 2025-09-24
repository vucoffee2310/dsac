// FILE: selectedsend3/lib/utils.js

export const escapeHtml = (text = '') => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

export const downloadJSON = (data, filename) => {
    const content = JSON.stringify(data, null, 2);
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};