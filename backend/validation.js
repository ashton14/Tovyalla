/**
 * Input validation using express-validator.
 * Export middleware and reusable validation chains for API routes.
 */
import { body, param, validationResult } from 'express-validator';

/** Send 400 with first validation error message. Call after validations run. */
export function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  const first = errors.array({ onlyFirstError: true })[0];
  return res.status(400).json({
    error: first.msg,
    field: first.path || first.type,
  });
}

// --- Auth ---
export const loginValidation = [
  body('companyID').trim().notEmpty().withMessage('companyID is required'),
  body('username').trim().notEmpty().withMessage('Username (email) is required'),
  body('password').notEmpty().withMessage('Password is required'),
];
export const registerValidation = [
  body('companyID').trim().notEmpty().withMessage('companyID is required'),
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Please enter a valid email address'),
  body('password').notEmpty().withMessage('Password is required').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 500 }).withMessage('Name is too long'),
];

// --- Billing ---
export const createCheckoutSessionValidation = [
  body('companyName').trim().notEmpty().withMessage('Company name is required').isLength({ max: 500 }).withMessage('Company name is too long'),
  body('ownerName').trim().notEmpty().withMessage('Your name is required').isLength({ max: 500 }).withMessage('Name is too long'),
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Please enter a valid email address'),
];
export const completeRegistrationValidation = [
  body('session_id').trim().notEmpty().withMessage('Session ID is required'),
  body('password').notEmpty().withMessage('Password is required').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
];

// --- Whitelist ---
export const whitelistPostValidation = [
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Invalid email format'),
];

// --- Company (optional fields; validate types when present) ---
// Settings sends '' for unset numeric fields; sanitize to undefined first so optional() skips validation (0 is valid)
const emptyStrToUndefined = (v) => (v === '' ? undefined : v);
const optionalEmail = () => body('email').customSanitizer(emptyStrToUndefined).optional({ values: 'null' }).isEmail().withMessage('Invalid email format');
const optionalUrl = () => body('website').trim().customSanitizer(emptyStrToUndefined).optional({ values: 'null' }).isLength({ max: 2000 }).withMessage('Website URL is too long');
const optionalPercent = (field) => body(field).customSanitizer(emptyStrToUndefined).optional().isFloat({ min: 0, max: 100 }).withMessage(`${field} must be between 0 and 100`);
const optionalNonNegative = (field) => body(field).customSanitizer(emptyStrToUndefined).optional().isFloat({ min: 0 }).withMessage(`${field} must be a non-negative number`);
const optionalBool = (field) => body(field).optional({ values: 'null' }).isBoolean().withMessage(`${field} must be true or false`);
export const companyPutValidation = [
  body('company_name').optional().isLength({ max: 500 }).withMessage('Company name is too long'),
  optionalEmail(),
  optionalUrl(),
  optionalPercent('default_initial_fee_percent'),
  optionalPercent('default_final_fee_percent'),
  optionalNonNegative('default_markup_percent'),
  optionalNonNegative('default_initial_fee_min'),
  optionalNonNegative('default_initial_fee_max'),
  optionalNonNegative('default_final_fee_min'),
  optionalNonNegative('default_final_fee_max'),
  optionalNonNegative('default_subcontractor_markup_percent'),
  optionalNonNegative('default_subcontractor_fee_min'),
  optionalNonNegative('default_subcontractor_fee_max'),
  optionalNonNegative('default_equipment_materials_markup_percent'),
  optionalNonNegative('default_equipment_materials_fee_min'),
  optionalNonNegative('default_equipment_materials_fee_max'),
  optionalNonNegative('default_additional_expenses_markup_percent'),
  optionalNonNegative('default_additional_expenses_fee_min'),
  optionalNonNegative('default_additional_expenses_fee_max'),
  optionalBool('auto_include_initial_payment'),
  optionalBool('auto_include_final_payment'),
  optionalBool('auto_include_subcontractor'),
  optionalBool('auto_include_equipment_materials'),
  optionalBool('auto_include_additional_expenses'),
];

// --- Customers ---
const maxStr = (len = 1000) => ({ max: len });
export const customerPostValidation = [
  body('first_name').trim().notEmpty().withMessage('First name is required').isLength(maxStr(255)),
  body('last_name').trim().notEmpty().withMessage('Last name is required').isLength(maxStr(255)),
  body('email').optional({ values: 'null' }).trim().isEmail().withMessage('Invalid email format'),
  body('phone').optional({ values: 'null' }).trim().isLength(maxStr(50)),
  body('pipeline_status').optional().trim().isLength(maxStr(100)),
  body('estimated_value').optional({ values: 'null' }).isFloat({ min: 0 }).withMessage('Estimated value must be non-negative'),
];
export const customerPutValidation = [
  body('first_name').optional().trim().notEmpty().withMessage('First name cannot be empty').isLength(maxStr(255)),
  body('last_name').optional().trim().notEmpty().withMessage('Last name cannot be empty').isLength(maxStr(255)),
  body('email').optional({ values: 'null' }).trim().isEmail().withMessage('Invalid email format'),
  body('phone').optional({ values: 'null' }).trim().isLength(maxStr(50)),
  body('pipeline_status').optional().trim().isLength(maxStr(100)),
  body('estimated_value').optional({ values: 'null' }).isFloat({ min: 0 }).withMessage('Estimated value must be non-negative'),
];

// --- Employees ---
export const employeePostValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength(maxStr(255)),
  body('email_address').trim().notEmpty().withMessage('Email address is required').isEmail().withMessage('Invalid email format'),
  body('user_type').optional().trim().isIn(['admin', 'manager', 'owner', 'employee']).withMessage('Invalid user type'),
  body('phone').optional({ values: 'null' }).trim().isLength(maxStr(50)),
  body('current').optional().isBoolean(),
  body('is_project_manager').optional().isBoolean(),
  body('is_sales_person').optional().isBoolean(),
  body('is_foreman').optional().isBoolean(),
  body('color').optional({ values: 'null' }).trim().isLength(maxStr(50)),
];
export const employeePutValidation = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty').isLength(maxStr(255)),
  body('email_address').optional().trim().notEmpty().withMessage('Email cannot be empty').isEmail().withMessage('Invalid email format'),
  body('user_type').optional().trim().isIn(['admin', 'manager', 'owner', 'employee']).withMessage('Invalid user type'),
  body('phone').optional({ values: 'null' }).trim().isLength(maxStr(50)),
  body('current').optional().isBoolean(),
  body('color').optional({ values: 'null' }).trim().isLength(maxStr(50)),
];

// --- Projects ---
const projectStatuses = ['lead', 'proposal_sent', 'sold', 'contract_sent', 'in_progress', 'completed', 'cancelled'];
export const projectPostValidation = [
  body('project_type').trim().notEmpty().withMessage('Project type is required').isLength(maxStr(100)),
  body('pool_or_spa').trim().notEmpty().withMessage('Pool or spa selection is required').isLength(maxStr(50)),
  body('project_name').optional().trim().isLength(maxStr(500)),
  body('status').optional().trim().isIn(projectStatuses).withMessage('Invalid project status'),
  body('sq_feet').optional({ values: 'null' }).isFloat({ min: 0 }).withMessage('Square feet must be non-negative'),
  body('est_value').optional({ values: 'null' }).isFloat({ min: 0 }).withMessage('Estimated value must be non-negative'),
  body('closing_price').optional({ values: 'null' }).isFloat({ min: 0 }).withMessage('Closing price must be non-negative'),
];
export const projectPutValidation = [
  body('project_type').optional().trim().notEmpty().withMessage('Project type cannot be empty').isLength(maxStr(100)),
  body('pool_or_spa').optional().trim().notEmpty().withMessage('Pool or spa cannot be empty').isLength(maxStr(50)),
  body('project_name').optional().trim().isLength(maxStr(500)),
  body('status').optional().trim().isIn(projectStatuses).withMessage('Invalid project status'),
  body('sq_feet').optional({ values: 'null' }).isFloat({ min: 0 }).withMessage('Square feet must be non-negative'),
  body('est_value').optional({ values: 'null' }).isFloat({ min: 0 }).withMessage('Estimated value must be non-negative'),
  body('closing_price').optional({ values: 'null' }).isFloat({ min: 0 }).withMessage('Closing price must be non-negative'),
];

// --- Inventory ---
export const inventoryPostValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength(maxStr(500)),
  body('unit').trim().notEmpty().withMessage('Unit is required').isLength(maxStr(50)),
  body('stock').optional({ values: 'null' }).isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  body('unit_price').optional({ values: 'null' }).isFloat({ min: 0 }).withMessage('Unit price must be non-negative'),
  body('type').optional().trim().isIn(['material', 'equipment']).withMessage('Type must be material or equipment'),
  body('brand').optional({ values: 'null' }).trim().isLength(maxStr(255)),
  body('model').optional({ values: 'null' }).trim().isLength(maxStr(255)),
  body('color').optional({ values: 'null' }).trim().isLength(maxStr(100)),
];
export const inventoryPutValidation = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty').isLength(maxStr(500)),
  body('unit').optional().trim().notEmpty().withMessage('Unit cannot be empty').isLength(maxStr(50)),
  body('stock').optional({ values: 'null' }).isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  body('unit_price').optional({ values: 'null' }).isFloat({ min: 0 }).withMessage('Unit price must be non-negative'),
  body('type').optional().trim().isIn(['material', 'equipment']).withMessage('Type must be material or equipment'),
];

// --- Subcontractors ---
export const subcontractorPostValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength(maxStr(500)),
  body('primary_contact_name').optional({ values: 'null' }).trim().isLength(maxStr(255)),
  body('primary_contact_phone').optional({ values: 'null' }).trim().isLength(maxStr(50)),
  body('primary_contact_email').optional({ values: 'null' }).trim().isEmail().withMessage('Invalid primary contact email'),
  body('coi_expiration').optional({ values: 'null' }).trim().custom((v) => !v || /^\d{4}-\d{2}-\d{2}/.test(v)).withMessage('COI expiration must be a valid date (YYYY-MM-DD)'),
  body('notes').optional({ values: 'null' }).trim().isLength(maxStr(5000)),
];
export const subcontractorPutValidation = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty').isLength(maxStr(500)),
  body('primary_contact_email').optional({ values: 'null' }).trim().isEmail().withMessage('Invalid primary contact email'),
  body('coi_expiration').optional({ values: 'null' }).trim().custom((v) => !v || /^\d{4}-\d{2}-\d{2}/.test(v)).withMessage('COI expiration must be a valid date (YYYY-MM-DD)'),
  body('notes').optional({ values: 'null' }).trim().isLength(maxStr(5000)),
];

// --- Goals ---
const dataPointTypes = ['revenue', 'projects_sold', 'projects_completed', 'custom'];
export const goalPostValidation = [
  body('goal_name').trim().notEmpty().withMessage('Goal name is required').isLength(maxStr(255)),
  body('data_point_type').trim().notEmpty().withMessage('Data point type is required').isIn(dataPointTypes).withMessage('Invalid data point type'),
  body('target_value').notEmpty().withMessage('Target value is required').isFloat({ min: 0 }).withMessage('Target value must be non-negative'),
  body('start_date').optional({ values: 'null' }).trim().custom((v) => !v || !isNaN(Date.parse(v))).withMessage('Start date must be a valid date'),
  body('target_date').optional({ values: 'null' }).trim().custom((v) => !v || !isNaN(Date.parse(v))).withMessage('Target date must be a valid date'),
];
export const goalPutValidation = [
  body('goal_name').optional().trim().notEmpty().withMessage('Goal name cannot be empty').isLength(maxStr(255)),
  body('data_point_type').optional().trim().isIn(dataPointTypes).withMessage('Invalid data point type'),
  body('target_value').optional({ values: 'null' }).isFloat({ min: 0 }).withMessage('Target value must be non-negative'),
  body('start_date').optional({ values: 'null' }).trim().custom((v) => !v || !isNaN(Date.parse(v))).withMessage('Start date must be a valid date'),
  body('target_date').optional({ values: 'null' }).trim().custom((v) => !v || !isNaN(Date.parse(v))).withMessage('Target date must be a valid date'),
];

// --- Params: UUID or numeric id ---
export const uuidParam = (name) => [param(name).isUUID().withMessage(`Invalid ${name}`)];
export const idParam = (name) => [param(name).notEmpty().withMessage(`${name} is required`)];
