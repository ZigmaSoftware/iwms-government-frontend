import { createElement, useMemo, type ComponentType } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";

import { decryptSegment } from "@/utils/routeCrypto";


// Import your actual page components
import ContinentList from "@/pages/admin/modules/superadmin/commonMasters/continent/ContinentListPage";
import ContinentForm from "@/pages/admin/modules/superadmin/commonMasters/continent/ContinentForm";
import CountryList from "@/pages/admin/modules/superadmin/commonMasters/country/CountryListPage";
import CountryForm from "@/pages/admin/modules/superadmin/commonMasters/country/CountryForm";
import StateList from "@/pages/admin/modules/superadmin/commonMasters/state/StateListPage";
import StateForm from "@/pages/admin/modules/superadmin/commonMasters/state/StateForm";
import DistrictList from "@/pages/admin/modules/masters/district/DistrictListPage";
import DistrictForm from "@/pages/admin/modules/masters/district/DistrictForm";
import DepartmentList from "@/pages/admin/modules/masters/department/DepartmentListPage";
import DepartmentForm from "@/pages/admin/modules/masters/department/DepartmentForm";
import DesignationList from "@/pages/admin/modules/masters/designation/DesignationListPage";
import DesignationForm from "@/pages/admin/modules/masters/designation/DesignationForm";
import CollectionPointListPage from "@/pages/admin/modules/core_modules/scheduleSetup/collectionPoint/CollectionPointListPage";
import CollectionPointForm from "@/pages/admin/modules/core_modules/scheduleSetup/collectionPoint/CollectionPointForm";
import WasteTypeListPage from "@/pages/admin/modules/masters/wasteMasters/wasteType/WasteTypeListPage";
import WasteTypeForm from "@/pages/admin/modules/masters/wasteMasters/wasteType/WasteTypeForm";
import BinListPage from "@/pages/admin/modules/masters/wasteMasters/bin/BinListPage";
import BinForm from "@/pages/admin/modules/masters/wasteMasters/bin/BinForm";


import PanchayatListPage from "@/pages/admin/modules/masters/panchayat/PanchayatListPage";
import PanchayatForm from "@/pages/admin/modules/masters/panchayat/PanchayatForm";
import PanchayatLeaderListPage from "@/pages/admin/modules/masters/leaderManagement/panchayatLeader/PanchayatLeaderListPage";
import PanchayatLeaderForm from "@/pages/admin/modules/masters/leaderManagement/panchayatLeader/PanchayatLeaderForm";
import DistrictLeaderListPage from "@/pages/admin/modules/masters/leaderManagement/districtLeader/DistrictLeaderListPage";
import DistrictLeaderForm from "@/pages/admin/modules/masters/leaderManagement/districtLeader/DistrictLeaderForm";
import StateLeaderListPage from "@/pages/admin/modules/masters/leaderManagement/stateLeader/StateLeaderListPage";
import StateLeaderForm from "@/pages/admin/modules/masters/leaderManagement/stateLeader/StateLeaderForm";
import AreaTypeListPage from "@/pages/admin/modules/masters/areaType/AreaTypeListPage";
import AreaTypeForm from "@/pages/admin/modules/masters/areaType/AreaTypeForm";
import HierarchyListPage from "@/pages/admin/modules/masters/hierarchy/HierarchyListPage";
import HierarchyForm from "@/pages/admin/modules/masters/hierarchy/HierarchyForm";
import MunicipalityListPage from "@/pages/admin/modules/masters/municipality/MunicipalityListPage";
import MunicipalityForm from "@/pages/admin/modules/masters/municipality/MunicipalityForm";
import TownPanchayatListPage from "@/pages/admin/modules/masters/townPanchayat/TownPanchayatListPage";
import TownPanchayatForm from "@/pages/admin/modules/masters/townPanchayat/TownPanchayatForm";
import CorporationListPage from "@/pages/admin/modules/masters/corporation/CorporationListPage";
import CorporationForm from "@/pages/admin/modules/masters/corporation/CorporationForm";
import PanchayatUnionListPage from "@/pages/admin/modules/masters/panchayatUnion/PanchayatUnionListPage";
import PanchayatUnionForm from "@/pages/admin/modules/masters/panchayatUnion/PanchayatUnionForm";


import PropertyList from "@/pages/admin/modules/masters/wasteMasters/property/PropertyListPage";
import PropertyForm from "@/pages/admin/modules/masters/wasteMasters/property/PropertyForm";
import SubPropertyList from "@/pages/admin/modules/masters/wasteMasters/subproperty/SubPropertyListPage";
import SubPropertyForm from "@/pages/admin/modules/masters/wasteMasters/subproperty/SubPropertyForm";
import StaffCreationList from "@/pages/admin/modules/superadmin/userManagement/staffCreation/staffcreationList";
import StaffCreationForm from "@/pages/admin/modules/superadmin/userManagement/staffCreation/staffcreationForm";
import StaffAccessConfigList from "@/pages/admin/modules/superadmin/userManagement/staffAccessConfiguration/StaffAccessConfigList";
import StaffAccessConfigPage from "@/pages/admin/modules/superadmin/userManagement/staffAccessConfiguration/StaffAccessConfigPage";
// Admin
import UserTypeList from "@/pages/admin/modules/superadmin/roleManagement/userType/user-typeList";
import UserTypeForm from "@/pages/admin/modules/superadmin/roleManagement/userType/user-typeForm";
// Customer Master
import CustomerCreationList from "@/pages/admin/modules/masters/customerMasters/customerCreations/customerCreationListPage";
import CustomerCreationForm from "@/pages/admin/modules/masters/customerMasters/customerCreations/customerCreationForm";
import ApartmentListPage from "@/pages/admin/modules/masters/customerMasters/customerCreations/apartmentListpage";
import HouseholdPickupEventList from "@/pages/admin/modules/masters/customerMasters/householdPickupEvent/householdPickupEventList";
import HouseholdPickupEventForm from "@/pages/admin/modules/masters/customerMasters/householdPickupEvent/householdPickupEventForm";

// Reports (Single components)
import TripSummary from "@/pages/admin/modules/reports/tripsummary/tripsummary";
import MonthlyDistance from "@/pages/admin/modules/reports/monthlydistance/monthlydistance";
import WasteSummary from "@/pages/admin/modules/reports/wasteCollectedSummary/wastesummary";
import MonthlyWasteComparisonListPage from "@/pages/admin/modules/reports/wasteReports/monthlyWasteComparison/MonthlyWasteComparisonListPage";
import TicketList from "@/pages/admin/modules/core_modules/complaintManagement/tickets/TicketList";
import TicketForm from "@/pages/admin/modules/core_modules/complaintManagement/tickets/TicketForm";
import TicketDetail from "@/pages/admin/modules/core_modules/complaintManagement/tickets/TicketDetail";
import FeedbackList from "@/pages/admin/modules/core_modules/complaintManagement/feedback/FeedbackList";
import FuelList from "@/pages/admin/modules/masters/transportMasters/fuel/fuelListPage";
import FuelForm from "@/pages/admin/modules/masters/transportMasters/fuel/fuelForm";
import VehicleTypeCreation from "@/pages/admin/modules/masters/transportMasters/vehicleTypecreation/vehicle-typeCreationList";
import VehicleTypeCreationForm from "@/pages/admin/modules/masters/transportMasters/vehicleTypecreation/vechicle-typeCreationForm";
import VehicleCreationListPage from "@/pages/admin/modules/masters/transportMasters/vehicleCreation/vehicleCreationListPage";
import VehicleCreationForm from "@/pages/admin/modules/masters/transportMasters/vehicleCreation/vehicleCreationForm";
import TripPlanList from "@/pages/admin/modules/core_modules/scheduleSetup/tripPlan/tripPlanList";
import TripPlanForm from "@/pages/admin/modules/core_modules/scheduleSetup/tripPlan/tripPlanForm";
import TripAttendanceList from "@/pages/admin/modules/masters/transportMasters/tripAttendance/tripAttendanceList";
import TripAttendanceForm from "@/pages/admin/modules/masters/transportMasters/tripAttendance/tripAttendanceForm";
import VehicleTripAuditList from "@/pages/admin/modules/masters/transportMasters/vehicleTripAudit/vehicleTripAuditList";
import VehicleTripAuditForm from "@/pages/admin/modules/masters/transportMasters/vehicleTripAudit/vehicleTripAuditForm";
import TripExceptionLogList from "@/pages/admin/modules/masters/transportMasters/tripExceptionLog/tripExceptionLogList";
import TripExceptionLogForm from "@/pages/admin/modules/masters/transportMasters/tripExceptionLog/tripExceptionLogForm";
import VehicleTracking from "@/pages/admin/modules/vehicletracking/vehicletrack/vehicletracking";
import VehicleHistory from "@/pages/admin/modules/vehicletracking/vehiclehistory/vehiclehistory";
import WorkforceManagement from "@/pages/admin/modules/workforcemanagement/workforcemanagement";
import DateReport from "@/pages/admin/modules/workforcemanagement/datereport";
import DayReport from "@/pages/admin/modules/workforcemanagement/dayreport";
import DailyTripAssignmentList from "@/pages/admin/modules/core_modules/dailyOperations/dailyTripAssignment/dailyTripAssignmentList"
import DailyTripAssignmentForm from "@/pages/admin/modules/core_modules/dailyOperations/dailyTripAssignment/dailyTripAssignmentForm";
import DailyTripTracking from "@/pages/admin/modules/core_modules/dailyOperations/dailyTripTracking/DailyTripTracking";
import DailyTripLogList from "@/pages/admin/modules/core_modules/dailyOperations/dailyTripLog/dailyTripLogList";

import PanchayatBaseCollectionListPage from "@/pages/admin/modules/wasteManagementMasters/panchayatbasecollection/PanchayatBaseCollectionListPage";
import WasteCollectedDataList from "@/pages/admin/modules/core_modules/dailyOperations/wasteCollectedData/wasteCollectedDataListPage";
import WasteCollectedForm from "@/pages/admin/modules/core_modules/dailyOperations/wasteCollectedData/wasteCollectedDataForm";
import StaffUserTypeForm from "@/pages/admin/modules/superadmin/roleManagement/staffUserType/staffUserTypeForm";
import StaffUserTypeList from "@/pages/admin/modules/superadmin/roleManagement/staffUserType/staffUserTypeList";

import CategoryList from "@/pages/admin/modules/core_modules/complaintManagement/category/CategoryList";
import CategoryForm from "@/pages/admin/modules/core_modules/complaintManagement/category/CategoryForm";
import SubcategoryList from "@/pages/admin/modules/core_modules/complaintManagement/subcategory/SubcategoryList";
import SubcategoryForm from "@/pages/admin/modules/core_modules/complaintManagement/subcategory/SubcategoryForm";
import ModuleList from "@/pages/admin/modules/core_modules/complaintManagement/masters/ModuleList";
import ModuleForm from "@/pages/admin/modules/core_modules/complaintManagement/masters/ModuleForm";
import PriorityList from "@/pages/admin/modules/core_modules/complaintManagement/masters/PriorityList";
import PriorityForm from "@/pages/admin/modules/core_modules/complaintManagement/masters/PriorityForm";
import StatusList from "@/pages/admin/modules/core_modules/complaintManagement/masters/StatusList";
import StatusForm from "@/pages/admin/modules/core_modules/complaintManagement/masters/StatusForm";
import SourceList from "@/pages/admin/modules/core_modules/complaintManagement/masters/SourceList";
import SourceForm from "@/pages/admin/modules/core_modules/complaintManagement/masters/SourceForm";
import TeamList from "@/pages/admin/modules/core_modules/complaintManagement/masters/TeamList";
import TeamForm from "@/pages/admin/modules/core_modules/complaintManagement/masters/TeamForm";
import SlaRuleList from "@/pages/admin/modules/core_modules/complaintManagement/masters/SlaRuleList";
import SlaRuleForm from "@/pages/admin/modules/core_modules/complaintManagement/masters/SlaRuleForm";
import MainScreenTypeList from "@/pages/admin/modules/superadmin/screenManagement/mainScreenType/mainScreenTypeList";
import MainScreenTypeForm from "@/pages/admin/modules/superadmin/screenManagement/mainScreenType/mainScreenTypeForm";
import UserScreenActionList from "@/pages/admin/modules/superadmin/screenManagement/userScreenAction/userScreenActionList";
import UserScreenActionForm from "@/pages/admin/modules/superadmin/screenManagement/userScreenAction/userScreenActionForm";
import MainScreenList from "@/pages/admin/modules/superadmin/screenManagement/mainScreen/mainScreenList";
import MainScreenForm from "@/pages/admin/modules/superadmin/screenManagement/mainScreen/mainScreenForm";
import UserScreenList from "@/pages/admin/modules/superadmin/screenManagement/userScreen/userScreenList";
import UserScreenForm from "@/pages/admin/modules/superadmin/screenManagement/userScreen/userScreenForm";
import UserScreenPermissionForm from "@/pages/admin/modules/superadmin/screenManagement/userScreenPermission/userScreenPermissionForm";
import UserScreenPermissionList from "@/pages/admin/modules/superadmin/screenManagement/userScreenPermission/userScreenPermissionList";
import StaffTemplateList from "@/pages/admin/modules/core_modules/scheduleSetup/staffTemplate/staffTemplateList";
import StaffTemplateForm from "@/pages/admin/modules/core_modules/scheduleSetup/staffTemplate/staffTemplateForm";
import AlternativeStaffTemplateList from "@/pages/admin/modules/core_modules/scheduleSetup/alternativeStaffTemplate/alternativeStaffTemplateList";
import AlternativeStaffTemplateForm from "@/pages/admin/modules/core_modules/scheduleSetup/alternativeStaffTemplate/alternativeStaffTemplateForm";
import BinCollectionEventList from "@/pages/admin/modules/core_modules/dailyOperations/binCollectionEvent/binCollectionEventList";
import BinCollectionEventForm from "@/pages/admin/modules/core_modules/dailyOperations/binCollectionEvent/binCollectionEventForm";
import VehicleBreakdownList from "@/pages/admin/modules/core_modules/dailyOperations/vehicleBreakdown/vehicleBreakdownList";
import VehicleBreakdownForm from "@/pages/admin/modules/core_modules/dailyOperations/vehicleBreakdown/vehicleBreakdownForm";
import SchedulerConfigPage from "@/pages/admin/modules/core_modules/dailyOperations/schedulerConfig/SchedulerConfigPage";
import DailyWasteComparisonList from "@/pages/admin/modules/reports/wasteReports/dailyWasteComparison/dailyWasteComparisonList";
import StaffTemplateAuditList from "@/pages/admin/modules/superadmin/audits/staffTemplateAudit/staffTemplateAuditList";
import StaffTemplateAuditForm from "@/pages/admin/modules/superadmin/audits/staffTemplateAudit/staffTemplateAuditForm";
import CommonAuditList from "@/pages/admin/modules/superadmin/audits/commonAudit/commonAuditList";
import LoginAuditList from "@/pages/admin/modules/superadmin/audits/loginAudit/loginAuditList";
import UnassignedStaffPoolList from "@/pages/admin/modules/superadmin/userManagement/unassignedStaffPool/unassignedStaffPoolList";
import UnassignedStaffPoolForm from "@/pages/admin/modules/superadmin/userManagement/unassignedStaffPool/unassignedStaffPoolForm";
import DailyAttendanceRegList from "@/pages/admin/modules/core_modules/attendance/DailyAttendanceRegList";


type ModuleComponent = ComponentType | undefined;

type RouteConfig = {
  list?: ModuleComponent;
  form?: ModuleComponent;
  editForm?: ModuleComponent;
  component?: ModuleComponent;
};

type RouteMap = Record<string, Record<string, RouteConfig>>;

const ROUTES: RouteMap = {
  attendance: {
    attendance: { component: DailyAttendanceRegList },
  },
  admins: {
    "user-type": { list: UserTypeList, form: UserTypeForm },
    "staff-user-type": { list: StaffUserTypeList, form: StaffUserTypeForm },
    "mainscreen-type": {list: MainScreenTypeList, form: MainScreenTypeForm},
    "userscreen-action": {list:UserScreenActionList, form: UserScreenActionForm },
    "mainscreens": {list: MainScreenList, form: MainScreenForm},
    "userscreens": {list: UserScreenList, form: UserScreenForm},
    "userscreenpermissions": {list: UserScreenPermissionList,form: UserScreenPermissionForm}
  },
  "common-masters": {
    continents: { list: ContinentList, form: ContinentForm },
    countries: { list: CountryList, form: CountryForm },
    states: { list: StateList, form: StateForm },
  },
  masters: {
    districts: { list: DistrictList, form: DistrictForm },
    departments: { list: DepartmentList, form: DepartmentForm },
    designations: { list: DesignationList, form: DesignationForm },

    panchayats: { list: PanchayatListPage, form: PanchayatForm },
    "panchayat-leaders": { list: PanchayatLeaderListPage, form: PanchayatLeaderForm },
    "district-leaders": { list: DistrictLeaderListPage, form: DistrictLeaderForm },
    "state-leaders": { list: StateLeaderListPage, form: StateLeaderForm },
    "area-types": { list: AreaTypeListPage, form: AreaTypeForm },
    hierarchies: { list: HierarchyListPage, form: HierarchyForm },
    corporations: { list: CorporationListPage, form: CorporationForm },
    municipalities: { list: MunicipalityListPage, form: MunicipalityForm },
    "town-panchayats": { list: TownPanchayatListPage, form: TownPanchayatForm },
    "panchayat-unions": { list: PanchayatUnionListPage, form: PanchayatUnionForm },
  },
  // Waste Masters (sidebar: Masters -> Waste Masters). Backend group "waste-types".
  "waste-types": {
    wastetypes: { list: WasteTypeListPage, form: WasteTypeForm },
    bins: { list: BinListPage, form: BinForm },
    properties: { list: PropertyList, form: PropertyForm },
    "sub-properties": { list: SubPropertyList, form: SubPropertyForm },
  },
  "user-creations": {
    "staff-creation": { list: StaffCreationList, form: StaffCreationForm },
    "staff-access-configuration": { list: StaffAccessConfigList, form: StaffAccessConfigPage },
    "unassigned-staff-pool": { list: UnassignedStaffPoolList, form: UnassignedStaffPoolForm },
  },
  "transport-master": {
    fuel: { list: FuelList, form: FuelForm },
    "vehicle-type": { list: VehicleTypeCreation, form: VehicleTypeCreationForm },
    "vehicle-creation": { list: VehicleCreationListPage, form: VehicleCreationForm },
    "trip-attendance": { list: TripAttendanceList, form: TripAttendanceForm },
    "vehicle-trip-audit": { list: VehicleTripAuditList, form: VehicleTripAuditForm },
    "trip-exception-log": { list: TripExceptionLogList, form: TripExceptionLogForm },
  },
  // Core Modules -> Schedule Setup. Backend group "schedule-setup".
  "schedule-setup": {
    "staff-template": {list: StaffTemplateList, form: StaffTemplateForm},
    "alternative-staff-template": {list: AlternativeStaffTemplateList, form: AlternativeStaffTemplateForm},
    "collection-points": { list: CollectionPointListPage, form: CollectionPointForm },
    "trip-plans": { list: TripPlanList, form: TripPlanForm },
  },
  // Core Modules -> Daily Operations. Backend group "schedule-operations".
  "schedule-operations": {
    "daily-trip-assignment": { list: DailyTripAssignmentList, form: DailyTripAssignmentForm },
    "daily-trip-tracking": { component: DailyTripTracking },
    "bin-collection-event": { list: BinCollectionEventList, form: BinCollectionEventForm },
    "vehicle-breakdowns": { list: VehicleBreakdownList, form: VehicleBreakdownForm },
    "scheduler-config": { component: SchedulerConfigPage },
    "daily-trip-log": { list: DailyTripLogList },
    "waste-collected-data": { list: WasteCollectedDataList, form: WasteCollectedForm },
  },
  // Reports -> Waste Reports ONLY. Backend group stays "schedule-masters".
  "schedule-masters": {
    "daily-waste-comparisons": { list: DailyWasteComparisonList },
    "monthly-waste-comparison": { list: MonthlyWasteComparisonListPage },
  },
  "customer-master": {
    "customer-creation": { list: CustomerCreationList, form: CustomerCreationForm },
    "apartment-list": { list: ApartmentListPage },
    "household-pickup-event": { list: HouseholdPickupEventList, form: HouseholdPickupEventForm },
  },
  "vehicle-tracking": {
    "vehicle-track": { component: VehicleTracking },
    "vehicle-history": { component: VehicleHistory },
  },
  "waste-management": {
    // "collection-monitoring": { list: CollectionMonitoringListPage, form: CollectionMonitoringForm },
    "panchayat-base-collection": { list: PanchayatBaseCollectionListPage },
  },
  "workforce-management": {
    "workforce-management": { component: WorkforceManagement },
    "date-report": { component: DateReport },
    "day-report": { component: DayReport },
  },
  "complaint-ticket": {
    complaint: { list: TicketList, form: TicketForm, editForm: TicketDetail },
    modules: { list: ModuleList, form: ModuleForm },
    categories: { list: CategoryList, form: CategoryForm },
    subcategories: { list: SubcategoryList, form: SubcategoryForm },
    priorities: { list: PriorityList, form: PriorityForm },
    statuses: { list: StatusList, form: StatusForm },
    sources: { list: SourceList, form: SourceForm },
    teams: { list: TeamList, form: TeamForm },
    "sla-rules": { list: SlaRuleList, form: SlaRuleForm },
    feedback: { list: FeedbackList },
  },
  audits: {
    "common-audit": { list: CommonAuditList },
    "login-audit": { list: LoginAuditList },
    "login-audits": { list: LoginAuditList },
    "staff-template-audit": { list: StaffTemplateAuditList, form: StaffTemplateAuditForm },
  },
  reports: {
    "trip-summary": { component: TripSummary },
    "monthly-distance": { component: MonthlyDistance },
    "waste-collected-summary": { component: WasteSummary },
    "monthly-waste-comparison": { list: MonthlyWasteComparisonListPage },
  },
  "leader-login": {
    "plb-leader-creation": { list: PanchayatLeaderListPage, form: PanchayatLeaderForm },
    "district-leader-creation": { list: DistrictLeaderListPage, form: DistrictLeaderForm },
    "state-leader-creation": { list: StateLeaderListPage, form: StateLeaderForm },
  },
};

const MASTER_ALIASES: Record<string, string[]> = {
  // Sidebar permission/module names -> router route groups
  "screen-managements": ["admins"],
  "role-assigns": ["admins"],
  "process-items": ["user-creations"],

  customers: ["customer-master"],
  "customer-masters": ["customer-master"],

  "transport-masters": ["transport-master"],

  // "schedule-setup" and "schedule-operations" are now real top-level buckets
  // (see ROUTES above) matching these alias keys exactly, so no alias entry is
  // needed for them anymore — resolveRouteConfig checks the literal value first.
  "schedule-reports": ["schedule-masters"],

  // Backward-compat bridges for the Masters/Schedule/User-Management regroup:
  // old master segments (still emitted by any not-yet-updated nav-link builder,
  // or an already-bookmarked/cached URL) resolve into their new real buckets.
  masters: ["waste-types"],
  assets: ["waste-types"],
  "staff-masters": ["user-creations", "audits"],
  "schedule-masters": ["schedule-setup", "schedule-operations"],

  collections: ["waste-management"],
};

const MODULE_ALIASES: Record<string, string[]> = {
  // Attendance
  attendance: ["attendance"],

  // Screen management
  mainscreentype: ["mainscreen-type"],
  "main-screen-type": ["mainscreen-type"],
  mainscreens: ["mainscreens"],
  userscreens: ["userscreens"],
  "userscreen-action": ["userscreen-action"],
  userscreenpermissions: [
    "userscreenpermissions",
    "companywisescreenpermissions",
  ],
  companywisescreenpermissions: ["userscreenpermissions"],

  // Role management
  "user-type": ["user-type"],
  "staff-user-type": ["staff-user-type"],
  staffusertypes: ["staff-user-type"],

  // User management
  staffcreation: ["staff-creation"],
  "staff-creation": ["staff-creation"],
  "staff-access-configuration": ["staff-access-configuration"],

  // Common/location masters
  continents: ["continents"],
  countries: ["countries"],
  states: ["states"],
  districts: ["districts"],
  "area-types": ["area-types"],
  areatypes: ["area-types"],
  corporations: ["corporations"],
  municipalities: ["municipalities"],
  "town-panchayats": ["town-panchayats"],
  "panchayat-unions": ["panchayat-unions"],
  panchayats: ["panchayats", "panchayat"],
  panchayat: ["panchayats"],

  // Waste/assets — the "waste-types" ROUTES bucket's WasteType entry is keyed
  // "wastetypes" (matching the renamed backend subgroup); bridge the page's
  // literal "waste-types" module segment (encWasteTypes) to it.
  wastetypes: ["wastetypes", "waste-types"],
  "waste-types": ["wastetypes"],
  properties: ["properties"],
  subproperties: ["sub-properties"],
  "sub-properties": ["sub-properties"],
  bins: ["bins"],

  // Customer
  customercreations: ["customer-creation"],
  "customer-creation": ["customer-creation"],
  "apartment-list": ["apartment-list"],

  // Complaint management
  tickets: ["complaint"],
  complaint: ["complaint", "complaints"],
  complaints: ["complaint"],
  modules: ["modules"],
  categories: ["categories", "main-complaint-category", "main-category"],
  "main-complaint-category": ["categories"],
  subcategories: ["subcategories", "sub-complaint-category", "sub-category"],
  "sub-complaint-category": ["subcategories"],
  priorities: ["priorities"],
  statuses: ["statuses"],
  sources: ["sources"],
  teams: ["teams"],
  feedback: ["feedback", "feedbacks"],
  feedbacks: ["feedback"],
  "sla-rules": ["sla-rules", "sla-rule", "sla_rules", "slaRules", "slarules", "sla"],
  "sla-rule": ["sla-rules"],
  sla_rules: ["sla-rules"],
  slaRules: ["sla-rules"],
  slarules: ["sla-rules"],
  sla: ["sla-rules"],

  // Transport
  "vehicle-type": ["vehicle-type"],
  "vehicle-creation": ["vehicle-creation"],
  fuels: ["fuel"],
  fuel: ["fuel"],
  "trip-attendance": ["trip-attendance"],
  "vehicle-trip-audit": ["vehicle-trip-audit"],
  "trip-exception-log": ["trip-exception-log"],

  // Schedule setup
  "staff-templates": ["staff-template"],
  "staff-template": ["staff-template"],
  "alternative-staff-templates": ["alternative-staff-template"],
  "alternative-staff-template": ["alternative-staff-template"],
  "collection-points": ["collection-points", "collection-point"],
  "collection-point": ["collection-points"],
  "trip-plans": ["trip-plans"],

  // Schedule operations
  "daily-trip-assignments": ["daily-trip-assignment"],
  "daily-trip-assignment": ["daily-trip-assignment"],
  "daily-trip-collection-points": ["daily-trip-tracking"],
  "daily-trip-collection-point": ["daily-trip-tracking"],
  "daily-trip-tracking": ["daily-trip-tracking"],
  "secondary-bin-collection-events": ["bin-collection-event"],
  "bin-collection-events": ["bin-collection-event"],
  "bin-collection-event": ["bin-collection-event"],
  "householdcollection-events": ["waste-collected-data"],
  "household-collection-events": ["waste-collected-data"],
  "waste-collected-data": ["waste-collected-data"],
  "vehicle-breakdowns": ["vehicle-breakdowns", "vehicle-breakdown"],
  "vehicle-breakdown": ["vehicle-breakdowns"],
  "daily-trip-logs": ["daily-trip-log"],
  "daily-trip-log": ["daily-trip-log"],

  // Schedule reports
  "daily-waste-comparisons": ["daily-waste-comparisons"],
  "daily-waste-comparison": ["daily-waste-comparisons"],
  MonthlyWasteComparison: ["monthly-waste-comparison"],
  "monthly-waste-comparison": ["monthly-waste-comparison"],

  // Audits
  "login-audit": ["login-audit", "login-audits"],
  "login-audits": ["login-audit", "login-audits"],
  "common-audit": ["common-audit"],

  // Leader login
  "plb-leader-creation": ["plb-leader-creation"],
  "district-leader-creation": ["district-leader-creation"],
  "state-leader-creation": ["state-leader-creation"],
};

const normalizeRouteKey = (value: string): string =>
  value.trim().replace(/_/g, "-").toLowerCase();

const getCandidates = (
  value: string,
  aliases: Record<string, string[]>,
): string[] => {
  const normalized = normalizeRouteKey(value);

  const directAliases = aliases[value] ?? [];
  const normalizedAliases = aliases[normalized] ?? [];

  return Array.from(
    new Set([
      value,
      normalized,
      ...directAliases,
      ...normalizedAliases,
      ...directAliases.map(normalizeRouteKey),
      ...normalizedAliases.map(normalizeRouteKey),
    ]),
  );
};

const resolveRouteConfig = (
  master: string,
  moduleName: string,
): RouteConfig | undefined => {
  const masterCandidates = getCandidates(master, MASTER_ALIASES);
  const moduleCandidates = getCandidates(moduleName, MODULE_ALIASES);

  for (const masterCandidate of masterCandidates) {
    const routeGroup =
      ROUTES[masterCandidate] ??
      ROUTES[normalizeRouteKey(masterCandidate)];
    if (!routeGroup) {
      continue;
    }

    for (const moduleCandidate of moduleCandidates) {
      const routeConfig =
        routeGroup[moduleCandidate] ??
        routeGroup[normalizeRouteKey(moduleCandidate)];

      if (routeConfig) {
        return routeConfig;
      }
    }
  }

  return undefined;
};

const resolveComponent = (config: RouteConfig | undefined, mode: "view" | "new" | "edit"): ModuleComponent => {
  if (!config) return undefined;

  if (config.component) return config.component;
  if (mode === "edit") return config.editForm ?? config.form;
  if (mode === "new") return config.form;
  return config.list;
};

export default function AdminEncryptedRouter() {
  const { encMaster, encModule, id } = useParams();
  const location = useLocation();

  const { master, moduleName } = useMemo(() => {
    return {
      master: decryptSegment(encMaster ?? ""),
      moduleName: decryptSegment(encModule ?? ""),
    };
  }, [encMaster, encModule]);

  if (!master || !moduleName) {
    return <Navigate to="/" replace />;
  }

  const moduleRoutes = resolveRouteConfig(master, moduleName);
  if (!moduleRoutes) {
    return <Navigate to="/" replace />;
  }

  const mode: "view" | "new" | "edit" =
    id ? "edit" : location.pathname.includes(`/${encModule}/new`) ? "new" : "view";
  const Component = resolveComponent(moduleRoutes, mode);

  if (!Component) {
    return <Navigate to="/" replace />;
  }

  return createElement(Component);
}
