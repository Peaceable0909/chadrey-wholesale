const ICONS = {
  tshirt: '<path d="M20 14 10 20l4 8 6-3v25h24V25l6 3 4-8-10-6-4 4h-12l-4-4Z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>',
  hoodie: '<path d="M32 10c-6 0-10 4-10 9l-8 3 3 8 5-2v22h20V28l5 2 3-8-8-3c0-5-4-9-10-9Z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/><path d="M26 20a6 6 0 0 0 12 0" stroke="currentColor" stroke-width="2.5"/>',
  polo: '<path d="M20 14 10 20l4 8 6-3v25h24V25l6 3 4-8-10-6-4 4h-4l-2 4-2-4h-4l-4-4Z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>',
  tank: '<path d="M22 14h20l3 10h-6v26H25V24h-6l3-10Z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>'
};

const PRODUCTS = [
  {
    id: 'oversized-tshirt',
    name: '100% Cotton Oversized T-Shirt',
    desc: 'Heavyweight cotton, drop-shoulder fit, pre-shrunk fabric for retail-ready quality.',
    icon: 'tshirt',
    moq: 50,
    colors: ['Black','White','Grey'],
    sizes: ['S','M','L','XL','XXL'],
    packaging: ['Individual poly bag','Bulk carton'],
    customization: ['Plain (no branding)','Custom print / logo']
  },
  {
    id: 'fleece-hoodie',
    name: 'Premium Fleece Hoodie',
    desc: 'Brushed-fleece interior, ribbed cuffs and hem, double-lined hood for structure.',
    icon: 'hoodie',
    moq: 30,
    colors: ['Black','Navy','Heather Grey'],
    sizes: ['S','M','L','XL','XXL'],
    packaging: ['Individual poly bag','Bulk carton'],
    customization: ['Plain (no branding)','Custom print / logo','Embroidered logo']
  },
  {
    id: 'classic-polo',
    name: 'Classic Pique Polo Shirt',
    desc: 'Breathable pique knit, reinforced collar, three-button placket, colorfast dye.',
    icon: 'polo',
    moq: 50,
    colors: ['White','Navy','Red'],
    sizes: ['S','M','L','XL','XXL'],
    packaging: ['Individual poly bag','Bulk carton'],
    customization: ['Plain (no branding)','Embroidered logo']
  },
  {
    id: 'cotton-tank',
    name: 'Cotton Tank Top',
    desc: 'Lightweight ribbed cotton, reinforced seams, suited for print-on-demand runs.',
    icon: 'tank',
    moq: 100,
    colors: ['Black','White'],
    sizes: ['S','M','L','XL'],
    packaging: ['Bulk carton'],
    customization: ['Plain (no branding)','Custom print / logo']
  }
];

// Fake existing quote records, for the "My Quotes" and "Admin" prototype views
const FAKE_QUOTES = [
  {
    ref: 'WR-2026-00125',
    product: '100% Cotton Oversized T-Shirt',
    qty: 500,
    color: 'Black', size: 'Mixed S–XXL',
    status: 'quoted', // pending | quoted | invoiced | paid
    date: 'Aug 2, 2026'
  },
  {
    ref: 'WR-2026-00118',
    product: 'Premium Fleece Hoodie',
    qty: 60,
    color: 'Navy', size: 'Mixed S–XL',
    status: 'pending',
    date: 'Aug 5, 2026'
  },
  {
    ref: 'WR-2026-00110',
    product: 'Classic Pique Polo Shirt',
    qty: 200,
    color: 'White', size: 'Mixed S–XXL',
    status: 'invoiced',
    date: 'Jul 22, 2026'
  },
  {
    ref: 'WR-2026-00099',
    product: 'Cotton Tank Top',
    qty: 300,
    color: 'Black', size: 'Mixed S–XL',
    status: 'paid',
    date: 'Jul 10, 2026'
  }
];

function statusBadge(status){
  const map = {
    pending:  {label:'Pending Review', cls:'badge-pending'},
    quoted:   {label:'Quotation Sent', cls:'badge-quoted'},
    invoiced: {label:'Invoice Sent',   cls:'badge-invoiced'},
    paid:     {label:'Paid',           cls:'badge-paid'}
  };
  const m = map[status] || map.pending;
  return `<span class="badge ${m.cls}">${m.label}</span>`;
}

function getQueryParam(name){
  return new URLSearchParams(window.location.search).get(name);
}
