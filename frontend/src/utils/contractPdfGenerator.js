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
const generatePaymentSchedule = (data) => {
  const schedule = []
  const { expenses, totals, project } = data
  
  // 1. Initial Contract Fee ($1,000)
  schedule.push({
    description: 'Initial Contract Fee',
    amount: 1000,
  })
  
  // 2. Subcontractor payments (one per job)
  if (expenses.subcontractorFees && expenses.subcontractorFees.length > 0) {
    expenses.subcontractorFees.forEach((fee) => {
      const amount = parseFloat(fee.expected_value || fee.flat_fee || 0)
      if (amount > 0) {
        schedule.push({
          description: `${fee.subcontractors?.name || 'Subcontractor'} - ${fee.job_description || 'Work'}`,
          amount,
        })
      }
    })
  }
  
  // 3. Equipment Order (total of all equipment)
  if (totals.equipment > 0 || totals.equipmentExpected > 0) {
    schedule.push({
      description: 'Equipment Order',
      amount: totals.equipmentExpected || totals.equipment || 0,
    })
  }
  
  // 4. Material Order (total of all materials)
  if (totals.materials > 0 || totals.materialsExpected > 0) {
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
  
  // Generate payment schedule
  const paymentSchedule = generatePaymentSchedule(contractData)
  const paymentTotal = paymentSchedule.reduce((sum, item) => sum + item.amount, 0)
  
  // Build equipment list
  const equipmentList = expenses.equipment && expenses.equipment.length > 0
    ? expenses.equipment.map((eq) => ({
        name: eq.name,
        description: eq.description || '',
        quantity: eq.quantity || 1,
        price: formatCurrency(parseFloat(eq.expected_price || eq.actual_price || 0) * (eq.quantity || 1)),
      }))
    : []
  
  // Build scope of work items from subcontractor fees
  const scopeOfWork = expenses.subcontractorFees && expenses.subcontractorFees.length > 0
    ? expenses.subcontractorFees.map((fee) => ({
        job: fee.job_description || 'Work',
        subcontractor: fee.subcontractors?.name || 'TBD',
        amount: formatCurrency(parseFloat(fee.expected_value || fee.flat_fee || 0)),
      }))
    : []

  // Define the document
  const docDefinition = {
    pageSize: 'LETTER',
    pageMargins: [40, 60, 40, 60],
    
    header: {
      columns: [
        { text: '', width: '*' },
        { 
          text: `Document #${docNumber}`, 
          alignment: 'right',
          margin: [0, 20, 40, 0],
          fontSize: 10,
          color: '#666666',
        },
      ],
    },
    
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: `Document #${docNumber}`, fontSize: 8, color: '#666666' },
        { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', fontSize: 8, color: '#666666' },
      ],
      margin: [40, 0, 40, 0],
    }),
    
    content: [
      // ================== COMPANY HEADER WITH LOGO ==================
      {
        columns: [
          // Logo column (left side)
          logoBase64 ? {
            width: 100,
            image: logoBase64,
            fit: [100, 80],
            margin: [0, 0, 20, 0],
          } : { text: '', width: 0 },
          // Company info column (right of logo)
          {
            width: '*',
            stack: [
              { text: company.company_name || 'Pool Construction Company', style: 'companyName' },
              ...companyAddress.map(line => ({ text: line, style: 'companyInfo' })),
              company.phone ? { text: `Phone: ${company.phone}`, style: 'companyInfo' } : {},
              company.website ? { text: `Website: ${company.website}`, style: 'companyInfo' } : {},
              licenseNumbers ? { text: `License: ${licenseNumbers}`, style: 'companyInfo' } : {},
            ],
          },
        ],
        margin: [0, 0, 0, 20],
      },
      
      // ================== CONTRACT TITLE ==================
      { text: 'POOL CONSTRUCTION CONTRACT', style: 'title', alignment: 'center' },
      { text: '\n' },
      
      // ================== CONTRACT METADATA ==================
      {
        columns: [
          { text: `Document Number: ${docNumber}`, style: 'label' },
          { text: `Document Date: ${formatDate(docDate)}`, style: 'label', alignment: 'right' },
        ],
        margin: [0, 0, 0, 20],
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
      
      // Scope of work items
      scopeOfWork.length > 0 ? {
        table: {
          headerRows: 1,
          widths: ['40%', '35%', '25%'],
          body: [
            [
              { text: 'Work Description', style: 'tableHeader' },
              { text: 'Subcontractor', style: 'tableHeader' },
              { text: 'Amount', style: 'tableHeader', alignment: 'right' },
            ],
            ...scopeOfWork.map(item => [
              { text: item.job, style: 'tableValue' },
              { text: item.subcontractor, style: 'tableValue' },
              { text: item.amount, style: 'tableValue', alignment: 'right' },
            ]),
          ],
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 10],
      } : { text: 'Scope of work to be determined.', style: 'note' },
      
      { text: '\n' },
      
      // Standard scope items (boilerplate)
      { text: 'Standard Work Includes:', style: 'subHeader' },
      {
        ul: [
          'Obtaining all necessary permits and inspections',
          'Contact DigAlert / utility mark-out',
          'Excavation of pool area',
          'Steel reinforcement installation',
          'Plumbing installation',
          'Electrical installation',
          'Pre-gunite, enclosure, and final inspections',
          'Gunite / concrete shell application',
          'Coping and tile installation',
          'Equipment installation',
          'Plaster application',
          'Pool start-up and initial chemical balancing',
        ],
        style: 'bulletList',
        margin: [0, 0, 0, 20],
      },
      
      // ================== EQUIPMENT LIST ==================
      equipmentList.length > 0 ? [
        { text: 'EQUIPMENT LIST', style: 'sectionHeader' },
        {
          table: {
            headerRows: 1,
            widths: ['40%', '30%', '10%', '20%'],
            body: [
              [
                { text: 'Equipment', style: 'tableHeader' },
                { text: 'Description', style: 'tableHeader' },
                { text: 'Qty', style: 'tableHeader', alignment: 'center' },
                { text: 'Price', style: 'tableHeader', alignment: 'right' },
              ],
              ...equipmentList.map(eq => [
                { text: eq.name, style: 'tableValue' },
                { text: eq.description, style: 'tableValue' },
                { text: eq.quantity.toString(), style: 'tableValue', alignment: 'center' },
                { text: eq.price, style: 'tableValue', alignment: 'right' },
              ]),
            ],
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 20],
        },
      ] : [],
      
      // ================== SITE CONDITIONS ==================
      { text: 'SITE CONDITION STATEMENT', style: 'sectionHeader' },
      { text: 'The following conditions and assumptions apply to this contract:', style: 'paragraph' },
      {
        ul: [
          'Contractor is not responsible for soil conditions that may affect the excavation process.',
          'Owner is responsible for providing accurate property line markers.',
          'Any underground obstacles (rocks, debris, pipes) discovered during excavation may result in additional charges.',
          'Natural settling of the pool deck and surrounding areas is normal and not covered under warranty.',
          'Owner is responsible for maintaining proper drainage away from the pool area.',
        ],
        style: 'bulletList',
        margin: [0, 0, 0, 20],
      },
      
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
              { text: formatCurrency(item.amount), style: 'tableValue', alignment: 'right' },
            ]),
            [
              { text: 'GRAND TOTAL', style: 'tableHeader', fillColor: '#f3f4f6' },
              { text: formatCurrency(totals.grandTotal || paymentTotal), style: 'tableHeader', alignment: 'right', fillColor: '#f3f4f6' },
            ],
          ],
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 20],
      },
      
      // ================== ACCESS AND PROPERTY CLAUSES ==================
      { text: 'PROPERTY AND ACCESS CLAUSES', style: 'sectionHeader' },
      
      { text: 'Property Lines', style: 'subHeader' },
      { text: 'Owner is responsible for providing accurate property line markers prior to excavation. Contractor is not responsible for encroachment onto neighboring properties if markers are incorrect.', style: 'paragraph', margin: [0, 0, 0, 10] },
      
      { text: 'Access to Work', style: 'subHeader' },
      { text: 'Owner grants Contractor access to the property and agrees to provide storage space for materials. Owner acknowledges that driveways and landscaping may be subject to wear and damage from construction equipment.', style: 'paragraph', margin: [0, 0, 0, 10] },
      
      { text: 'Underground Pipes and Utilities', style: 'subHeader' },
      { text: 'Contractor is not responsible for damage to sprinkler systems, water lines, sewer lines, or electrical conduits not properly marked or disclosed prior to excavation.', style: 'paragraph', margin: [0, 0, 0, 10] },
      
      { text: 'Damages to Property', style: 'subHeader' },
      { text: 'Contractor is not responsible for damage caused by acts of God (weather, earthquakes, etc.) or damage caused by the Owner or third parties. Owner is responsible for protecting personal property during construction.', style: 'paragraph', margin: [0, 0, 0, 20] },
      
      // ================== LEGAL CLAUSES ==================
      { text: 'GENERAL CONDITIONS', style: 'sectionHeader' },
      
      { text: 'Legal Fees', style: 'subHeader' },
      { text: 'In the event of any legal action arising from this contract, the prevailing party shall be entitled to recover reasonable attorney\'s fees and costs.', style: 'paragraph', margin: [0, 0, 0, 10] },
      
      { text: 'Work Stoppage', style: 'subHeader' },
      { text: 'Contractor reserves the right to stop work if payments are not received according to the milestone payment schedule. Work will resume upon receipt of all outstanding payments plus any applicable late fees.', style: 'paragraph', margin: [0, 0, 0, 10] },
      
      { text: 'Mechanics\' Lien Notice', style: 'subHeader' },
      { text: 'Anyone who helps improve your property, but who is not paid, may record what is called a mechanics\' lien on your property. A mechanics\' lien is a claim, like a mortgage or home equity loan, made against your property and recorded with the county recorder.', style: 'paragraph', margin: [0, 0, 0, 10] },
      
      { text: 'Licensed Contractor Notice', style: 'subHeader' },
      { text: 'Contractors are required by law to be licensed and regulated by the Contractors\' State License Board. Any questions concerning a contractor may be referred to the registrar of the board.', style: 'paragraph', margin: [0, 0, 0, 20] },
      
      // ================== COMPANY TERMS OF SERVICE ==================
      ...(company.terms_of_service ? [
        { text: 'ADDITIONAL TERMS & CONDITIONS', style: 'sectionHeader' },
        { text: company.terms_of_service, style: 'paragraph', margin: [0, 0, 0, 20] },
      ] : []),
      
      // ================== WARRANTY ==================
      { text: 'CONTRACTOR LIABILITY & WARRANTY', style: 'sectionHeader', pageBreak: 'before' },
      
      { text: 'Workmanship Warranty', style: 'subHeader' },
      { text: 'Contractor warrants all workmanship for a period of one (1) year from the date of completion. This warranty covers defects in installation and labor.', style: 'paragraph', margin: [0, 0, 0, 10] },
      
      { text: 'Material Warranty', style: 'subHeader' },
      { text: 'Materials are covered by their respective manufacturer warranties. Contractor will assist Owner in processing any manufacturer warranty claims.', style: 'paragraph', margin: [0, 0, 0, 10] },
      
      { text: 'Warranty Limitations', style: 'subHeader' },
      { text: 'The warranty does not cover:', style: 'paragraph' },
      {
        ul: [
          'Normal wear and tear',
          'Damage caused by improper maintenance',
          'Damage caused by chemical imbalance',
          'Damage caused by freezing or natural disasters',
          'Cosmetic imperfections in plaster, tile, or coping that do not affect functionality',
          'Changes made by Owner or third parties after completion',
        ],
        style: 'bulletList',
        margin: [0, 0, 0, 20],
      },
      
      // ================== EXCLUSIONS ==================
      { text: 'EXCLUSIONS', style: 'sectionHeader' },
      { text: 'The following items are NOT included in this contract unless specifically stated:', style: 'paragraph' },
      {
        ul: [
          'Fencing and gates',
          'Soil reports and engineering (unless specified)',
          'Special city requirements or additional permitting fees',
          'Landscaping and irrigation repair',
          'Pool deck and concrete flatwork (unless specified)',
          'Sprinkler system repair or relocation',
          'Utility upgrades or connections',
        ],
        style: 'bulletList',
        margin: [0, 0, 0, 20],
      },
      
      // ================== OWNER RESPONSIBILITIES ==================
      { text: 'OWNER RESPONSIBILITIES', style: 'sectionHeader' },
      { text: 'Owner agrees to:', style: 'paragraph' },
      {
        ul: [
          'Fill the pool with water as instructed by Contractor',
          'Stop water fill at the correct level as indicated',
          'Maintain proper water chemistry after start-up',
          'Follow all maintenance instructions provided',
          'Provide electrical and water utilities as needed for construction',
          'Keep children and pets away from the construction area',
        ],
        style: 'bulletList',
        margin: [0, 0, 0, 20],
      },
      
      // ================== ALTERATIONS ==================
      { text: 'NOTES & ALTERATIONS', style: 'sectionHeader' },
      { text: 'Any alterations or additions to this contract after signing may result in additional charges. All changes must be documented in writing and signed by both parties.', style: 'paragraph' },
      { text: '\n' },
      { text: project.notes || 'No additional notes.', style: 'note', margin: [0, 0, 0, 20] },
      
      // ================== NOTICE OF RIGHT TO CANCEL ==================
      { text: 'NOTICE OF RIGHT TO CANCEL', style: 'sectionHeader' },
      { text: 'You, the buyer, may cancel this transaction at any time prior to midnight of the third business day after the date of this transaction. See the attached notice of cancellation form for an explanation of this right.', style: 'paragraph', margin: [0, 0, 0, 10] },
      { text: 'To cancel this contract, mail or deliver a signed and dated copy of the cancellation notice, or any other written notice, to the contractor at the address shown above.', style: 'paragraph', margin: [0, 0, 0, 20] },
      
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
