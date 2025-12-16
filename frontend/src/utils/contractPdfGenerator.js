// pdfmake setup for Vite
import * as pdfMakeModule from 'pdfmake/build/pdfmake'
import * as pdfFontsModule from 'pdfmake/build/vfs_fonts'

const pdfMake = pdfMakeModule.default || pdfMakeModule
const pdfFonts = pdfFontsModule.default || pdfFontsModule

// Initialize pdfmake with fonts
pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.vfs

// Helper function to format currency
const formatCurrency = (amount) => {
  if (!amount || isNaN(amount)) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

// Helper function to format date
const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// Generate payment schedule based on expenses
// If customerPaymentSchedule is provided, use that instead (customer-facing prices)
const generatePaymentSchedule = (data) => {
  const docType = data.documentType || 'contract'
  
  // For proposals, return simplified schedule
  if (docType === 'proposal') {
    // If customer payment schedule is provided, use it (but should only have initial fee for proposals)
    if (data.customerPaymentSchedule && data.customerPaymentSchedule.length > 0) {
      return data.customerPaymentSchedule
    }
    
    // Otherwise, return proposal schedule: Initial sign fee + balance message
    return [
      {
        description: 'Initial Sign Fee',
        amount: 1000,
      },
      {
        description: 'Balance of schedule will be provided with contract',
        amount: 0,
      },
    ]
  }
  
  // For change orders, return simplified schedule
  if (docType === 'change_order') {
    // If customer payment schedule is provided, use it
    if (data.customerPaymentSchedule && data.customerPaymentSchedule.length > 0) {
      return data.customerPaymentSchedule
    }
    
    // Otherwise, return change order schedule: Initial fee + balance message
    return [
      {
        description: 'Initial Fee',
        amount: 0,
      },
      {
        description: 'Balance of schedule will be provided with contract',
        amount: 0,
      },
    ]
  }
  
  // For contracts (default behavior)
  // If customer payment schedule is provided, use it directly
  if (data.customerPaymentSchedule && data.customerPaymentSchedule.length > 0) {
    return data.customerPaymentSchedule
  }
  
  // Otherwise, generate from internal costs (legacy behavior)
  const schedule = []
  const { expenses, totals, project } = data
  
  // 1. Initial Contract Fee ($1,000)
  schedule.push({
    description: 'Initial Contract Fee',
    amount: 0,
  })
  
  // 2. Subcontractor payments (one per job)
  if (expenses.subcontractorFees && expenses.subcontractorFees.length > 0) {
    expenses.subcontractorFees.forEach((fee) => {
      const amount = parseFloat(fee.expected_value || fee.flat_fee || 0)
      if (amount > 0) {
        schedule.push({
          description: fee.job_description || 'Work',
          amount,
        })
      }
    })
  }
  
  // 3. Equipment Order (total of all equipment) - always include if equipment exists
  if (expenses.equipment && Array.isArray(expenses.equipment) && expenses.equipment.length > 0) {
    schedule.push({
      description: 'Equipment Order',
      amount: totals.equipmentExpected || totals.equipment || 0,
    })
  }
  
  // 4. Material Order (total of all materials) - always include if materials exist
  if (expenses.materials && expenses.materials.length > 0) {
    schedule.push({
      description: 'Material Order',
      amount: totals.materialsExpected || totals.materials || 0,
    })
  }
  
  // 5. Additional Fees (total of additional expenses)
  if (totals.additional > 0 || totals.additionalExpected > 0) {
    schedule.push({
      description: 'Additional Fees',
      amount: totals.additionalExpected || totals.additional || 0,
    })
  }
  
  // 6. Final Inspection ($1,000)
  schedule.push({
    description: 'Final Inspection',
    amount: 1000,
  })
  
  return schedule
}

// Helper function to convert image URL to base64 for pdfmake
const getImageAsBase64 = async (url) => {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.error('Error loading image:', error)
    return null
  }
}

// Generate the contract PDF
export const generateContractPdf = async (contractData) => {
  const {
    documentNumber,
    documentDate,
    documentType,
    company,
    project,
    customer,
    expenses,
    totals,
  } = contractData
  
  // Support legacy field names for backwards compatibility
  const docNumber = documentNumber || contractData.contractNumber
  const docDate = documentDate || contractData.contractDate
  const docType = documentType || 'contract'
  
  // Load company logo if available
  let logoBase64 = null
  if (company.logo_url) {
    logoBase64 = await getImageAsBase64(company.logo_url)
  }
  
  // Build company address
  const companyAddress = [
    company.address_line1,
    company.address_line2,
    [company.city, company.state, company.zip_code].filter(Boolean).join(', '),
  ].filter(Boolean)
  
  // Build customer address
  const customerAddress = customer ? [
    customer.address_line1,
    customer.address_line2,
    [customer.city, customer.state, customer.zip_code].filter(Boolean).join(', '),
  ].filter(Boolean) : []
  
  // Build license numbers string
  const licenseNumbers = company.license_numbers && Array.isArray(company.license_numbers) 
    ? company.license_numbers.join(', ') 
    : (company.license_numbers || '')
  
  // Generate payment schedule (uses customerPaymentSchedule if provided)
  const paymentSchedule = generatePaymentSchedule(contractData)
  const paymentTotal = contractData.customerGrandTotal || paymentSchedule.reduce((sum, item) => sum + item.amount, 0)
  
  // Build equipment list (no prices - prices are shown in payment schedule)
  const equipmentList = expenses.equipment && expenses.equipment.length > 0
    ? expenses.equipment.map((eq) => ({
        name: eq.inventory?.name || eq.name || 'Equipment',
        description: eq.description || eq.inventory?.description || '',
        quantity: eq.quantity || 1,
      }))
    : []
  
  // Build scope of work items
  // For change orders, use custom change order items
  // For contracts/proposals, use subcontractor fees
  let scopeOfWork = []
  if (docType === 'change_order' && contractData.changeOrderItems && contractData.changeOrderItems.length > 0) {
    // For change orders, use custom items with name + description
    scopeOfWork = contractData.changeOrderItems
      .filter(item => item.name) // Only include items with a name
      .map((item) => ({
        item: item.name,
        description: item.description || '',
      }))
  } else if (expenses.subcontractorFees && expenses.subcontractorFees.length > 0) {
    // For contracts/proposals, use subcontractor fees
    scopeOfWork = expenses.subcontractorFees.map((fee) => ({
      job: fee.job_description || 'Work',
      subcontractor: fee.subcontractors?.name || 'TBD',
    }))
  }

  // Build contact info string (phone, website on same line if both exist)
  const contactParts = []
  if (company.phone) contactParts.push(company.phone)
  if (company.website) contactParts.push(company.website)
  const contactLine = contactParts.join('  •  ')

  // Define the document
  const docDefinition = {
    pageSize: 'LETTER',
    pageMargins: [40, 100, 40, 60],
    
    header: (currentPage, pageCount) => ({
      margin: [40, 20, 40, 0],
      stack: [
        {
          columns: [
            // Logo column (left side)
            logoBase64 ? {
              width: 60,
              image: logoBase64,
              fit: [60, 50],
            } : { text: '', width: 0 },
            // Company info column (center)
            {
              width: '*',
              stack: [
                { text: company.company_name || 'Pool Construction Company', fontSize: 14, bold: true, color: '#1e40af' },
                { text: companyAddress.join('  •  '), fontSize: 8, color: '#6b7280', margin: [0, 2, 0, 0] },
                contactLine ? { text: contactLine, fontSize: 8, color: '#6b7280' } : {},
                licenseNumbers ? { text: `License: ${licenseNumbers}`, fontSize: 8, color: '#6b7280' } : {},
              ],
              margin: [logoBase64 ? 10 : 0, 0, 0, 0],
            },
            // Document number column (right side)
            {
              width: 'auto',
              stack: [
                { text: `#${docNumber}`, fontSize: 12, bold: true, color: '#374151', alignment: 'right' },
                { text: formatDate(docDate), fontSize: 8, color: '#6b7280', alignment: 'right' },
              ],
            },
          ],
          columnGap: 10,
        },
        // Separator line
        {
          canvas: [
            { type: 'line', x1: 0, y1: 8, x2: 532, y2: 8, lineWidth: 1, lineColor: '#e5e7eb' }
          ],
        },
      ],
    }),
    
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: `${company.company_name || ''}`, fontSize: 8, color: '#9ca3af' },
        { text: `Document #${docNumber}  •  Page ${currentPage} of ${pageCount}`, alignment: 'right', fontSize: 8, color: '#9ca3af' },
      ],
      margin: [40, 0, 40, 0],
    }),
    
    content: [
      // ================== CONTRACT TITLE ==================
      { 
        text: docType === 'proposal' 
          ? 'POOL CONSTRUCTION PROPOSAL' 
          : docType === 'change_order'
          ? 'CHANGE ORDER'
          : 'POOL CONSTRUCTION CONTRACT', 
        style: 'title', 
        alignment: 'center', 
        margin: [0, 0, 0, 20] 
      },
      
      // ================== PROJECT INFORMATION ==================
      { text: 'PROJECT INFORMATION', style: 'sectionHeader' },
      {
        table: {
          widths: ['30%', '70%'],
          body: [
            [{ text: 'Project Address:', style: 'tableLabel' }, { text: project.address || 'TBD', style: 'tableValue' }],
            [{ text: 'Project Type:', style: 'tableLabel' }, { text: `${project.project_type || ''} - ${project.pool_or_spa || ''}`.toUpperCase(), style: 'tableValue' }],
            [{ text: 'Square Feet:', style: 'tableLabel' }, { text: project.sq_feet ? `${project.sq_feet} sq ft` : 'TBD', style: 'tableValue' }],
          ],
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 20],
      },
      
      // ================== CLIENT INFORMATION ==================
      { text: 'CLIENT INFORMATION', style: 'sectionHeader' },
      customer ? {
        table: {
          widths: ['30%', '70%'],
          body: [
            [{ text: 'Client Name:', style: 'tableLabel' }, { text: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'TBD', style: 'tableValue' }],
            [{ text: 'Client Address:', style: 'tableLabel' }, { text: customerAddress.join(', ') || 'TBD', style: 'tableValue' }],
            [{ text: 'Client Email:', style: 'tableLabel' }, { text: customer.email || 'TBD', style: 'tableValue' }],
            [{ text: 'Client Phone:', style: 'tableLabel' }, { text: customer.phone || 'TBD', style: 'tableValue' }],
          ],
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 20],
      } : { text: 'No customer assigned to this project.', style: 'note', margin: [0, 0, 0, 20] },
      
      // ================== SCOPE OF WORK ==================
      { text: 'SCOPE OF WORK', style: 'sectionHeader' },
      { text: 'The Contractor agrees to perform the following work:', style: 'paragraph' },
      { text: '\n' },
      
      // Scope of work items (no amounts - prices are shown in payment schedule)
      scopeOfWork.length > 0 ? (
        docType === 'change_order' ? {
          // For change orders, show item name and description
          table: {
            headerRows: 1,
            widths: ['100%'],
            body: [
              [
                { text: 'Item', style: 'tableHeader' },
              ],
              ...scopeOfWork.map(item => [
                { 
                  text: [
                    { text: item.item || '', style: 'tableValue', bold: true },
                    item.description ? { text: `\n${item.description}`, style: 'tableValue' } : '',
                  ],
                  style: 'tableValue',
                },
              ]),
            ],
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 10],
        } : {
          // For contracts/proposals, show work description and subcontractor
          table: {
            headerRows: 1,
            widths: ['60%', '40%'],
            body: [
              [
                { text: 'Work Description', style: 'tableHeader' },
                { text: 'Subcontractor', style: 'tableHeader' },
              ],
              ...scopeOfWork.map(item => [
                { text: item.job, style: 'tableValue' },
                { text: item.subcontractor, style: 'tableValue' },
              ]),
            ],
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 10],
        }
      ) : { text: 'Scope of work to be determined.', style: 'note' },
      
      { text: '\n' },
      
      // ================== EQUIPMENT LIST ==================
      // Hide equipment list for change orders
      (docType !== 'change_order' && equipmentList.length > 0) ? [
        { text: 'EQUIPMENT LIST', style: 'sectionHeader' },
        {
          table: {
            headerRows: 1,
            widths: ['40%', '45%', '15%'],
            body: [
              [
                { text: 'Equipment', style: 'tableHeader' },
                { text: 'Description', style: 'tableHeader' },
                { text: 'Qty', style: 'tableHeader', alignment: 'center' },
              ],
              ...equipmentList.map(eq => [
                { text: eq.name, style: 'tableValue' },
                { text: eq.description, style: 'tableValue' },
                { text: eq.quantity.toString(), style: 'tableValue', alignment: 'center' },
              ]),
            ],
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 20],
        },
      ] : [],
      
      // ================== PAYMENT SCHEDULE ==================
      { text: 'MILESTONE PAYMENT SCHEDULE', style: 'sectionHeader', pageBreak: 'before' },
      {
        table: {
          headerRows: 1,
          widths: ['70%', '30%'],
          body: [
            [
              { text: 'Milestone', style: 'tableHeader' },
              { text: 'Amount', style: 'tableHeader', alignment: 'right' },
            ],
            ...paymentSchedule.map(item => [
              { text: item.description, style: 'tableValue' },
              { text: item.amount === 0 && item.description.toLowerCase().includes('balance') ? '-' : formatCurrency(item.amount), style: 'tableValue', alignment: 'right' },
            ]),
            [
              { text: 'GRAND TOTAL', style: 'tableHeader', fillColor: '#f3f4f6' },
              { text: formatCurrency(paymentTotal), style: 'tableHeader', alignment: 'right', fillColor: '#f3f4f6' },
            ],
          ],
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 20],
      },
      
      // ================== COMPANY TERMS OF SERVICE ==================
      ...(company.terms_of_service ? [
        { text: 'TERMS & CONDITIONS', style: 'sectionHeader' },
        { text: company.terms_of_service, style: 'paragraph', margin: [0, 0, 0, 20] },
      ] : []),
      
      // ================== NOTES ==================
      ...(project.notes ? [
        { text: 'NOTES', style: 'sectionHeader' },
        { text: project.notes, style: 'paragraph', margin: [0, 0, 0, 20] },
      ] : []),
      
      // ================== SIGNATURES ==================
      { text: 'SIGNATURES', style: 'sectionHeader', pageBreak: 'before' },
      { text: 'By signing below, both parties agree to the terms and conditions set forth in this contract.', style: 'paragraph', margin: [0, 0, 0, 20] },
      
      // Owner Signature Block
      { text: 'OWNER', style: 'subHeader' },
      {
        columns: [
          {
            width: '60%',
            stack: [
              { text: '_'.repeat(50), margin: [0, 30, 0, 5] },
              { text: 'Signature', style: 'signatureLabel' },
              { text: '\n' },
              { text: '_'.repeat(50), margin: [0, 20, 0, 5] },
              { text: 'Printed Name', style: 'signatureLabel' },
            ],
          },
          {
            width: '40%',
            stack: [
              { text: '_'.repeat(30), margin: [0, 30, 0, 5] },
              { text: 'Date', style: 'signatureLabel' },
            ],
          },
        ],
        margin: [0, 0, 0, 30],
      },
      
      // Contractor Signature Block
      { text: 'CONTRACTOR', style: 'subHeader' },
      {
        columns: [
          {
            width: '60%',
            stack: [
              { text: '_'.repeat(50), margin: [0, 30, 0, 5] },
              { text: 'Signature', style: 'signatureLabel' },
              { text: '\n' },
              { text: '_'.repeat(50), margin: [0, 20, 0, 5] },
              { text: 'Printed Name', style: 'signatureLabel' },
              { text: '\n' },
              { text: company.company_name || '', style: 'companyInfo' },
            ],
          },
          {
            width: '40%',
            stack: [
              { text: '_'.repeat(30), margin: [0, 30, 0, 5] },
              { text: 'Date', style: 'signatureLabel' },
            ],
          },
        ],
        margin: [0, 0, 0, 30],
      },
      
      // ================== DOCUMENT FOOTER ==================
      { text: '\n' },
      {
        table: {
          widths: ['100%'],
          body: [[
            {
              text: [
                { text: 'Document Generated: ', bold: true },
                { text: new Date().toLocaleString() },
                { text: ' | Document #', bold: true },
                { text: docNumber },
              ],
              style: 'footer',
              alignment: 'center',
              fillColor: '#f9fafb',
            },
          ]],
        },
        layout: 'noBorders',
      },
    ],
    
    // ================== STYLES ==================
    styles: {
      companyName: {
        fontSize: 18,
        bold: true,
        color: '#1e40af',
        margin: [0, 0, 0, 5],
      },
      companyInfo: {
        fontSize: 10,
        color: '#4b5563',
        margin: [0, 1, 0, 1],
      },
      title: {
        fontSize: 20,
        bold: true,
        color: '#111827',
        margin: [0, 10, 0, 10],
      },
      sectionHeader: {
        fontSize: 14,
        bold: true,
        color: '#1e40af',
        margin: [0, 15, 0, 10],
        decoration: 'underline',
      },
      subHeader: {
        fontSize: 11,
        bold: true,
        color: '#374151',
        margin: [0, 5, 0, 5],
      },
      paragraph: {
        fontSize: 10,
        color: '#374151',
        lineHeight: 1.4,
      },
      label: {
        fontSize: 10,
        bold: true,
        color: '#6b7280',
      },
      tableHeader: {
        fontSize: 10,
        bold: true,
        color: '#111827',
        fillColor: '#f3f4f6',
      },
      tableLabel: {
        fontSize: 10,
        bold: true,
        color: '#6b7280',
      },
      tableValue: {
        fontSize: 10,
        color: '#111827',
      },
      bulletList: {
        fontSize: 10,
        color: '#374151',
        margin: [10, 0, 0, 0],
      },
      note: {
        fontSize: 9,
        italics: true,
        color: '#6b7280',
      },
      signatureLabel: {
        fontSize: 9,
        color: '#6b7280',
      },
      footer: {
        fontSize: 8,
        color: '#9ca3af',
      },
    },
    
    defaultStyle: {
      font: 'Roboto',
    },
  }
  
  return pdfMake.createPdf(docDefinition)
}

// Download the PDF
export const downloadContractPdf = async (contractData) => {
  const pdf = await generateContractPdf(contractData)
  const docNum = contractData.documentNumber || contractData.contractNumber
  const docType = contractData.documentType || 'Contract'
  const typeLabel = docType.charAt(0).toUpperCase() + docType.slice(1).replace('_', ' ')
  const fileName = `${typeLabel}_${docNum}_${contractData.project?.address?.replace(/[^a-zA-Z0-9]/g, '_') || 'Project'}.pdf`
  pdf.download(fileName)
}

// Open the PDF in a new tab
export const openContractPdf = async (contractData) => {
  const pdf = await generateContractPdf(contractData)
  pdf.open()
}

// Get the PDF as a blob
export const getContractPdfBlob = async (contractData) => {
  const pdf = await generateContractPdf(contractData)
  return new Promise((resolve) => {
    pdf.getBlob((blob) => {
      resolve(blob)
    })
  })
}

export default {
  generateContractPdf,
  downloadContractPdf,
  openContractPdf,
  getContractPdfBlob,
}
