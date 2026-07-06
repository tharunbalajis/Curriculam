function formatAuthorName(fullName) {
  const name = fullName.trim();

  // Already in "Initials Surname" or "Surname Initials" style with periods present.
  const parts = name.split(/\s+/);
  if (parts.length === 1) {
    return parts[0];
  }

  const last = parts[parts.length - 1];
  const rest = parts.slice(0, parts.length - 1);

  // If the last token already looks like initials (e.g. "Deitel" then "P.J."
  // appears earlier), detect the pattern "Initials Surname" e.g. "P.J. Deitel".
  const looksLikeInitials = (token) => /^([A-Z]\.){1,}$/.test(token) || /^([A-Z]\.)+[A-Z]?\.?$/.test(token);

  if (parts.length === 2 && looksLikeInitials(parts[0])) {
    // "P.J. Deitel" -> "Deitel P.J."
    return `${parts[1]} ${parts[0]}`;
  }

  // Default case: "Reema Thareja" -> "Thareja R."; multiple given names get a
  // space between initials ("T. L. Floyd"), per the university's own style.
  const initials = rest.map((n) => `${n.charAt(0).toUpperCase()}.`).join(' ');
  return `${last} ${initials}`;
}

function formatAuthors(authors) {
  const formatted = (authors || []).map(formatAuthorName).filter(Boolean);

  if (formatted.length === 0) return '';
  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2) return `${formatted[0]} and ${formatted[1]}`;

  const allButLast = formatted.slice(0, -1).join(', ');
  const last = formatted[formatted.length - 1];
  return `${allButLast}, and ${last}`;
}

// Matches the university master template's citation style exactly:
// "Author(s), 'Title'. Edition edition, Publisher, Place, Year."
// — note the period right after the closing quote of the title (not a
// comma), confirmed against the real master copy rather than guessed.
function formatReference({ authors, title, edition, publisher, place, year }) {
  const authorsPart = formatAuthors(authors);
  const titlePart = title ? `'${title}'.` : '';

  const tail = [];
  if (edition) tail.push(`${edition} edition`);
  if (publisher) tail.push(publisher);
  if (place) tail.push(place);
  if (year) tail.push(String(year));
  const tailPart = tail.length ? `${tail.join(', ')}.` : '';

  return [authorsPart ? `${authorsPart},` : '', titlePart, tailPart].filter(Boolean).join(' ');
}

module.exports = { formatReference, formatAuthors, formatAuthorName };
