export type FeedbackRecord = {
  unique_id: string;
  customer?: string;
  customer_id?: string | number;
  customer_unique_id?: string;
  customer_name?: string;
  category?: string;
  feedback_details?: string;
  zone_name?: string;
  city_name?: string;
  company_id?: string | null;
  company_unique_id?: string | null;
  company_name?: string | null;
  project_id?: string | null;
  project_unique_id?: string | null;
  project_name?: string | null;
};
