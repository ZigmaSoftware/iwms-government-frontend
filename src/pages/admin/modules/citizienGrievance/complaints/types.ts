export type Complaint = {
  id: number;
  unique_id: string;
  customer_name: string;
  contact_no: string;
  main_category?: string | null;
  sub_category?: string | null;
  category?: string;
  details: string;
  priority?: string | null;
  address: string;
  image_url?: string;
  close_image_url?: string;
  status: string;
  action_remarks?: string;
  created: string;
  complaint_closed_at?: string | null;
};
