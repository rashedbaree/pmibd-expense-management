export type UserRole =
  | "submitter"
  | "portfolio_director"
  | "finance_director"
  | "president"
  | "admin";

export type ExpenseStatus =
  | "draft"
  | "submitted"
  | "pending_approval"
  | "returned"
  | "rejected"
  | "approved"
  | "paid";

export type PaymentMethod = "cheque" | "bank_transfer" | "cash";

export type EntryType = "expense" | "reversal";

export type ApprovalAction = "approve" | "reject" | "return" | "comment";

export interface Portfolio {
  id: string;
  name: string;
  full_visibility?: boolean;
}

export interface RoleFullVisibility {
  role: UserRole;
  full_visibility: boolean;
}

export interface EventRow {
  id: string;
  name: string;
  date: string;
  portfolio_id: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  parent_category_id: string | null;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  portfolio_id: string | null;
  is_active: boolean;
}

export interface Expense {
  id: string;
  date: string;
  portfolio_id: string;
  event_id: string | null;
  category_id: string;
  description: string;
  vendor: string | null;
  payment_method: PaymentMethod;
  amount: number;
  status: ExpenseStatus;
  submitted_by: string;
  remarks: string | null;
  cheque_number: string | null;
  entry_type: EntryType;
  reverses_expense_id: string | null;
  required_approval_role: UserRole | null;
  current_approver_role: UserRole | null;
  created_at: string;
}

export interface BankStatementLine {
  id: string;
  date: string;
  cheque_number: string;
  amount: number;
  description: string | null;
  remarks: string | null;
  created_at: string;
}

export interface ExpenseApproval {
  id: string;
  expense_id: string;
  approver_id: string;
  action: ApprovalAction;
  comment: string | null;
  acted_at: string;
}
