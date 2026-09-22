import { lazy, type ComponentType } from "react";

const ContinentList = lazy(() => import("@/pages/admin/modules/superadmin/commonMasters/continent/ContinentListPage"));
const ContinentForm = lazy(() => import("@/pages/admin/modules/superadmin/commonMasters/continent/ContinentForm"));
const CountryList = lazy(() => import("@/pages/admin/modules/superadmin/commonMasters/country/CountryListPage"));
const CountryForm = lazy(() => import("@/pages/admin/modules/superadmin/commonMasters/country/CountryForm"));
const StateList = lazy(() => import("@/pages/admin/modules/superadmin/commonMasters/state/StateListPage"));
const StateForm = lazy(() => import("@/pages/admin/modules/superadmin/commonMasters/state/StateForm"));
const DistrictList = lazy(() => import("@/pages/admin/modules/masters/district/DistrictListPage"));
const DistrictForm = lazy(() => import("@/pages/admin/modules/masters/district/DistrictForm"));
const DepartmentList = lazy(() => import("@/pages/admin/modules/masters/department/list/DepartmentListPage"));
const DepartmentForm = lazy(() => import("@/pages/admin/modules/masters/department/form/DepartmentForm"));
const DesignationList = lazy(() => import("@/pages/admin/modules/masters/designation/list/DesignationListPage"));
const DesignationForm = lazy(() => import("@/pages/admin/modules/masters/designation/form/DesignationForm"));
const CollectionPointListPage = lazy(() => import("@/pages/admin/modules/core_modules/scheduleSetup/collectionPoint/CollectionPointListPage"));
const CollectionPointForm = lazy(() => import("@/pages/admin/modules/core_modules/scheduleSetup/collectionPoint/CollectionPointForm"));
const WasteTypeListPage = lazy(() => import("@/pages/admin/modules/masters/wasteMasters/wasteType/WasteTypeListPage"));
const WasteTypeForm = lazy(() => import("@/pages/admin/modules/masters/wasteMasters/wasteType/WasteTypeForm"));
const BinListPage = lazy(() => import("@/pages/admin/modules/masters/wasteMasters/bin/BinListPage"));
const BinForm = lazy(() => import("@/pages/admin/modules/masters/wasteMasters/bin/BinForm"));
const PanchayatListPage = lazy(() => import("@/pages/admin/modules/masters/panchayat/PanchayatListPage"));
const PanchayatForm = lazy(() => import("@/pages/admin/modules/masters/panchayat/PanchayatForm"));
const PanchayatLeaderListPage = lazy(() => import("@/pages/admin/modules/masters/leaderManagement/panchayatLeader/PanchayatLeaderListPage"));
const PanchayatLeaderForm = lazy(() => import("@/pages/admin/modules/masters/leaderManagement/panchayatLeader/PanchayatLeaderForm"));
const DistrictLeaderListPage = lazy(() => import("@/pages/admin/modules/masters/leaderManagement/districtLeader/DistrictLeaderListPage"));
const DistrictLeaderForm = lazy(() => import("@/pages/admin/modules/masters/leaderManagement/districtLeader/DistrictLeaderForm"));
const StateLeaderListPage = lazy(() => import("@/pages/admin/modules/masters/leaderManagement/stateLeader/StateLeaderListPage"));
const StateLeaderForm = lazy(() => import("@/pages/admin/modules/masters/leaderManagement/stateLeader/StateLeaderForm"));
const AreaTypeListPage = lazy(() => import("@/pages/admin/modules/masters/areaType/list/AreaTypeListPage"));
const AreaTypeForm = lazy(() => import("@/pages/admin/modules/masters/areaType/form/AreaTypeForm"));
const HierarchyListPage = lazy(() => import("@/pages/admin/modules/masters/hierarchy/HierarchyListPage"));
const HierarchyForm = lazy(() => import("@/pages/admin/modules/masters/hierarchy/HierarchyForm"));
const MunicipalityListPage = lazy(() => import("@/pages/admin/modules/masters/municipality/MunicipalityListPage"));
const MunicipalityForm = lazy(() => import("@/pages/admin/modules/masters/municipality/MunicipalityForm"));
const TownPanchayatListPage = lazy(() => import("@/pages/admin/modules/masters/townPanchayat/TownPanchayatListPage"));
const TownPanchayatForm = lazy(() => import("@/pages/admin/modules/masters/townPanchayat/TownPanchayatForm"));
const CorporationListPage = lazy(() => import("@/pages/admin/modules/masters/corporation/CorporationListPage"));
const CorporationForm = lazy(() => import("@/pages/admin/modules/masters/corporation/CorporationForm"));
const PanchayatUnionListPage = lazy(() => import("@/pages/admin/modules/masters/panchayatUnion/PanchayatUnionListPage"));
const PanchayatUnionForm = lazy(() => import("@/pages/admin/modules/masters/panchayatUnion/PanchayatUnionForm"));
const WardListPage = lazy(() => import("@/pages/admin/modules/masters/ward/WardListPage"));
const WardForm = lazy(() => import("@/pages/admin/modules/masters/ward/WardForm"));
const PropertyList = lazy(() => import("@/pages/admin/modules/masters/wasteMasters/property/PropertyListPage"));
const PropertyForm = lazy(() => import("@/pages/admin/modules/masters/wasteMasters/property/PropertyForm"));
const SubPropertyList = lazy(() => import("@/pages/admin/modules/masters/wasteMasters/subproperty/SubPropertyListPage"));
const SubPropertyForm = lazy(() => import("@/pages/admin/modules/masters/wasteMasters/subproperty/SubPropertyForm"));
const StaffCreationList = lazy(() => import("@/pages/admin/modules/superadmin/userManagement/staffCreation/staffcreationList"));
const StaffCreationForm = lazy(() => import("@/pages/admin/modules/superadmin/userManagement/staffCreation/staffcreationForm"));
const StaffAccessConfigList = lazy(() => import("@/pages/admin/modules/superadmin/userManagement/staffAccessConfiguration/StaffAccessConfigList"));
const AppModuleList = lazy(() => import("@/pages/admin/modules/superadmin/screenManagement/appModules/AppModuleList"));
const CustomerAccessConfigList = lazy(() => import("@/pages/admin/modules/masters/customerMasters/customerAccessConfiguration/CustomerAccessConfigList"));
const StaffAccessConfigPage = lazy(() => import("@/pages/admin/modules/superadmin/userManagement/staffAccessConfiguration/StaffAccessConfigPage"));
const StaffAccessDashboard = lazy(() => import("@/pages/admin/modules/superadmin/userManagement/staffAccessDashboard/StaffAccessDashboard"));
const UserTypeList = lazy(() => import("@/pages/admin/modules/superadmin/roleManagement/userType/user-typeList"));
const UserTypeForm = lazy(() => import("@/pages/admin/modules/superadmin/roleManagement/userType/user-typeForm"));
const CustomerCreationList = lazy(() => import("@/pages/admin/modules/masters/customerMasters/customerCreations/customerCreationListPage"));
const CustomerCreationForm = lazy(() => import("@/pages/admin/modules/masters/customerMasters/customerCreations/customerCreationForm"));
const ApartmentListPage = lazy(() => import("@/pages/admin/modules/masters/customerMasters/customerCreations/apartmentListpage"));
const HouseholdPickupEventList = lazy(() => import("@/pages/admin/modules/masters/customerMasters/householdPickupEvent/householdPickupEventList"));
const HouseholdPickupEventForm = lazy(() => import("@/pages/admin/modules/masters/customerMasters/householdPickupEvent/householdPickupEventForm"));
const MonthlyWasteComparisonListPage = lazy(() => import("@/pages/admin/modules/reports/wasteReports/monthlyWasteComparison/MonthlyWasteComparisonListPage"));
const TicketList = lazy(() => import("@/pages/admin/modules/core_modules/complaintManagement/tickets/TicketList"));
const TicketForm = lazy(() => import("@/pages/admin/modules/core_modules/complaintManagement/tickets/TicketForm"));
const TicketDetail = lazy(() => import("@/pages/admin/modules/core_modules/complaintManagement/tickets/TicketDetail"));
const FeedbackList = lazy(() => import("@/pages/admin/modules/core_modules/complaintManagement/feedback/FeedbackList"));
const FuelList = lazy(() => import("@/pages/admin/modules/masters/transportMasters/fuel/fuelListPage"));
const FuelForm = lazy(() => import("@/pages/admin/modules/masters/transportMasters/fuel/fuelForm"));
const VehicleTypeCreation = lazy(() => import("@/pages/admin/modules/masters/transportMasters/vehicleTypecreation/vehicle-typeCreationList"));
const VehicleTypeCreationForm = lazy(() => import("@/pages/admin/modules/masters/transportMasters/vehicleTypecreation/vechicle-typeCreationForm"));
const VehicleCreationListPage = lazy(() => import("@/pages/admin/modules/masters/transportMasters/vehicleCreation/vehicleCreationListPage"));
const VehicleCreationForm = lazy(() => import("@/pages/admin/modules/masters/transportMasters/vehicleCreation/vehicleCreationForm"));
const TripPlanList = lazy(() => import("@/pages/admin/modules/core_modules/scheduleSetup/tripPlan/tripPlanList"));
const TripPlanForm = lazy(() => import("@/pages/admin/modules/core_modules/scheduleSetup/tripPlan/tripPlanForm"));
const TripAttendanceList = lazy(() => import("@/pages/admin/modules/masters/transportMasters/tripAttendance/tripAttendanceList"));
const TripAttendanceForm = lazy(() => import("@/pages/admin/modules/masters/transportMasters/tripAttendance/tripAttendanceForm"));
const VehicleTripAuditList = lazy(() => import("@/pages/admin/modules/masters/transportMasters/vehicleTripAudit/vehicleTripAuditList"));
const VehicleTripAuditForm = lazy(() => import("@/pages/admin/modules/masters/transportMasters/vehicleTripAudit/vehicleTripAuditForm"));
const TripExceptionLogList = lazy(() => import("@/pages/admin/modules/masters/transportMasters/tripExceptionLog/tripExceptionLogList"));
const TripExceptionLogForm = lazy(() => import("@/pages/admin/modules/masters/transportMasters/tripExceptionLog/tripExceptionLogForm"));
const DailyTripAssignmentList = lazy(() => import("@/pages/admin/modules/core_modules/dailyOperations/dailyTripAssignment/dailyTripAssignmentList"));
const DailyTripAssignmentForm = lazy(() => import("@/pages/admin/modules/core_modules/dailyOperations/dailyTripAssignment/dailyTripAssignmentForm"));
const DailyTripTracking = lazy(() => import("@/pages/admin/modules/core_modules/dailyOperations/dailyTripTracking/DailyTripTracking"));
const DailyTripLogList = lazy(() => import("@/pages/admin/modules/core_modules/dailyOperations/dailyTripLog/dailyTripLogList"));
const PanchayatBaseCollectionListPage = lazy(() => import("@/pages/admin/modules/wasteManagementMasters/panchayatbasecollection/PanchayatBaseCollectionListPage"));
const WasteCollectedDataList = lazy(() => import("@/pages/admin/modules/core_modules/dailyOperations/wasteCollectedData/wasteCollectedDataListPage"));
const WasteCollectedForm = lazy(() => import("@/pages/admin/modules/core_modules/dailyOperations/wasteCollectedData/wasteCollectedDataForm"));
const StaffUserTypeForm = lazy(() => import("@/pages/admin/modules/superadmin/roleManagement/staffUserType/staffUserTypeForm"));
const StaffUserTypeList = lazy(() => import("@/pages/admin/modules/superadmin/roleManagement/staffUserType/staffUserTypeList"));
const CategoryList = lazy(() => import("@/pages/admin/modules/core_modules/complaintManagement/category/CategoryList"));
const CategoryForm = lazy(() => import("@/pages/admin/modules/core_modules/complaintManagement/category/CategoryForm"));
const SubcategoryList = lazy(() => import("@/pages/admin/modules/core_modules/complaintManagement/subcategory/SubcategoryList"));
const SubcategoryForm = lazy(() => import("@/pages/admin/modules/core_modules/complaintManagement/subcategory/SubcategoryForm"));
const ModuleList = lazy(() => import("@/pages/admin/modules/core_modules/complaintManagement/masters/ModuleList"));
const ModuleForm = lazy(() => import("@/pages/admin/modules/core_modules/complaintManagement/masters/ModuleForm"));
const PriorityList = lazy(() => import("@/pages/admin/modules/core_modules/complaintManagement/masters/PriorityList"));
const PriorityForm = lazy(() => import("@/pages/admin/modules/core_modules/complaintManagement/masters/PriorityForm"));
const StatusList = lazy(() => import("@/pages/admin/modules/core_modules/complaintManagement/masters/StatusList"));
const StatusForm = lazy(() => import("@/pages/admin/modules/core_modules/complaintManagement/masters/StatusForm"));
const SourceList = lazy(() => import("@/pages/admin/modules/core_modules/complaintManagement/masters/SourceList"));
const SourceForm = lazy(() => import("@/pages/admin/modules/core_modules/complaintManagement/masters/SourceForm"));
const TeamList = lazy(() => import("@/pages/admin/modules/core_modules/complaintManagement/masters/TeamList"));
const TeamForm = lazy(() => import("@/pages/admin/modules/core_modules/complaintManagement/masters/TeamForm"));
const SlaRuleList = lazy(() => import("@/pages/admin/modules/core_modules/complaintManagement/masters/SlaRuleList"));
const SlaRuleForm = lazy(() => import("@/pages/admin/modules/core_modules/complaintManagement/masters/SlaRuleForm"));
const MainScreenTypeList = lazy(() => import("@/pages/admin/modules/superadmin/screenManagement/mainScreenType/mainScreenTypeList"));
const MainScreenTypeForm = lazy(() => import("@/pages/admin/modules/superadmin/screenManagement/mainScreenType/mainScreenTypeForm"));
const UserScreenActionList = lazy(() => import("@/pages/admin/modules/superadmin/screenManagement/userScreenAction/userScreenActionList"));
const UserScreenActionForm = lazy(() => import("@/pages/admin/modules/superadmin/screenManagement/userScreenAction/userScreenActionForm"));
const MainScreenList = lazy(() => import("@/pages/admin/modules/superadmin/screenManagement/mainScreen/mainScreenList"));
const MainScreenForm = lazy(() => import("@/pages/admin/modules/superadmin/screenManagement/mainScreen/mainScreenForm"));
const UserScreenList = lazy(() => import("@/pages/admin/modules/superadmin/screenManagement/userScreen/userScreenList"));
const UserScreenForm = lazy(() => import("@/pages/admin/modules/superadmin/screenManagement/userScreen/userScreenForm"));
const UserScreenPermissionForm = lazy(() => import("@/pages/admin/modules/superadmin/screenManagement/userScreenPermission/userScreenPermissionForm"));
const UserScreenPermissionList = lazy(() => import("@/pages/admin/modules/superadmin/screenManagement/userScreenPermission/userScreenPermissionList"));
const StaffTemplateList = lazy(() => import("@/pages/admin/modules/core_modules/scheduleSetup/staffTemplate/staffTemplateList"));
const StaffTemplateForm = lazy(() => import("@/pages/admin/modules/core_modules/scheduleSetup/staffTemplate/staffTemplateForm"));
const AlternativeStaffTemplateList = lazy(() => import("@/pages/admin/modules/core_modules/scheduleSetup/alternativeStaffTemplate/alternativeStaffTemplateList"));
const AlternativeStaffTemplateForm = lazy(() => import("@/pages/admin/modules/core_modules/scheduleSetup/alternativeStaffTemplate/alternativeStaffTemplateForm"));
const BinCollectionEventList = lazy(() => import("@/pages/admin/modules/core_modules/dailyOperations/binCollectionEvent/binCollectionEventList"));
const BinCollectionEventForm = lazy(() => import("@/pages/admin/modules/core_modules/dailyOperations/binCollectionEvent/binCollectionEventForm"));
const VehicleBreakdownList = lazy(() => import("@/pages/admin/modules/core_modules/dailyOperations/vehicleBreakdown/vehicleBreakdownList"));
const VehicleBreakdownForm = lazy(() => import("@/pages/admin/modules/core_modules/dailyOperations/vehicleBreakdown/vehicleBreakdownForm"));
const TripRetripRequestList = lazy(() => import("@/pages/admin/modules/core_modules/dailyOperations/tripRetripRequest/tripRetripRequestList"));
const SchedulerConfigPage = lazy(() => import("@/pages/admin/modules/core_modules/dailyOperations/schedulerConfig/SchedulerConfigPage"));
const DailyWasteComparisonList = lazy(() => import("@/pages/admin/modules/reports/wasteReports/dailyWasteComparison/dailyWasteComparisonList"));
const StaffTemplateAuditList = lazy(() => import("@/pages/admin/modules/superadmin/audits/staffTemplateAudit/staffTemplateAuditList"));
const StaffTemplateAuditForm = lazy(() => import("@/pages/admin/modules/superadmin/audits/staffTemplateAudit/staffTemplateAuditForm"));
const CommonAuditList = lazy(() => import("@/pages/admin/modules/superadmin/audits/commonAudit/commonAuditList"));
const LoginAuditList = lazy(() => import("@/pages/admin/modules/superadmin/audits/loginAudit/loginAuditList"));
const PermissionAuditList = lazy(() => import("@/pages/admin/modules/superadmin/audits/permissionAudit/permissionAuditList"));
const StaffChangeRequestList = lazy(() => import("@/pages/admin/modules/superadmin/audits/staffChangeRequest/staffChangeRequestList"));
const UnassignedStaffPoolList = lazy(() => import("@/pages/admin/modules/superadmin/userManagement/unassignedStaffPool/unassignedStaffPoolList"));
const UnassignedStaffPoolForm = lazy(() => import("@/pages/admin/modules/superadmin/userManagement/unassignedStaffPool/unassignedStaffPoolForm"));
const DailyAttendanceRegList = lazy(() => import("@/pages/admin/modules/core_modules/attendance/DailyAttendanceRegList"));

export type ModuleComponent = ComponentType | undefined;

export type RouteConfig = {
  list?: ModuleComponent;
  form?: ModuleComponent;
  editForm?: ModuleComponent;
  component?: ModuleComponent;
};

export type RouteMap = Record<string, Record<string, RouteConfig>>;

export const ROUTES: RouteMap = {
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
    "userscreenpermissions": {list: UserScreenPermissionList,form: UserScreenPermissionForm},
    "app-modules": { list: AppModuleList }
  },
  // Screen Management now routes under its own master segment (encSuperAdmin);
  // "admins" above is kept only so already-open/bookmarked tabs still resolve.
  "screen-management": {
    "mainscreen-type": {list: MainScreenTypeList, form: MainScreenTypeForm},
    "userscreen-action": {list:UserScreenActionList, form: UserScreenActionForm },
    "mainscreens": {list: MainScreenList, form: MainScreenForm},
    "userscreens": {list: UserScreenList, form: UserScreenForm},
    "userscreenpermissions": {list: UserScreenPermissionList,form: UserScreenPermissionForm},
    "app-modules": { list: AppModuleList }
  },
  // Role Management now routes under its own master segment (encRoleManagement).
  "role-management": {
    "user-type": { list: UserTypeList, form: UserTypeForm },
    "staff-user-type": { list: StaffUserTypeList, form: StaffUserTypeForm },
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
    wards: { list: WardListPage, form: WardForm },
  },
  "waste-types": {
    wastetypes: { list: WasteTypeListPage, form: WasteTypeForm },
    bins: { list: BinListPage, form: BinForm },
    properties: { list: PropertyList, form: PropertyForm },
    "sub-properties": { list: SubPropertyList, form: SubPropertyForm },
  },
  "user-creations": {
    "staff-creation": { list: StaffCreationList, form: StaffCreationForm },
    "staff-access-configuration": { list: StaffAccessConfigList, form: StaffAccessConfigPage },
    "staff-access-dashboard": { component: StaffAccessDashboard },
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
  "schedule-setup": {
    "staff-template": {list: StaffTemplateList, form: StaffTemplateForm},
    "alternative-staff-template": {list: AlternativeStaffTemplateList, form: AlternativeStaffTemplateForm},
    "collection-points": { list: CollectionPointListPage, form: CollectionPointForm },
    "trip-plans": { list: TripPlanList, form: TripPlanForm },
  },
  "schedule-operations": {
    "daily-trip-assignment": { list: DailyTripAssignmentList, form: DailyTripAssignmentForm },
    "daily-trip-tracking": { component: DailyTripTracking },
    "bin-collection-event": { list: BinCollectionEventList, form: BinCollectionEventForm },
    "vehicle-breakdowns": { list: VehicleBreakdownList, form: VehicleBreakdownForm },
    "retrip-requests": { component: TripRetripRequestList },
    "scheduler-config": { component: SchedulerConfigPage },
    "daily-trip-log": { list: DailyTripLogList },
    "waste-collected-data": { list: WasteCollectedDataList, form: WasteCollectedForm },
  },
  "schedule-masters": {
    "daily-waste-comparisons": { list: DailyWasteComparisonList },
    "monthly-waste-comparison": { list: MonthlyWasteComparisonListPage },
  },
  "customer-master": {
    "customer-creation": { list: CustomerCreationList, form: CustomerCreationForm },
    "apartment-list": { list: ApartmentListPage },
    "customer-access-configuration": { list: CustomerAccessConfigList },
    "household-pickup-event": { list: HouseholdPickupEventList, form: HouseholdPickupEventForm },
  },
  "waste-management": {
    "panchayat-base-collection": { list: PanchayatBaseCollectionListPage },
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
    // Both folded into Transaction Audit (commonAuditList.tsx handles
    // hierarchy auto-scoping and an "Approvals only" toggle itself now) —
    // old bookmarked URLs land on the same merged page rather than 404ing
    // or showing a now-unlinked standalone screen.
    "staff-audit": { list: CommonAuditList },
    "approval-history": { list: CommonAuditList },
    "login-audit": { list: LoginAuditList },
    "login-audits": { list: LoginAuditList },
    "staff-template-audit": { list: StaffTemplateAuditList, form: StaffTemplateAuditForm },
    "permission-audit": { list: PermissionAuditList },
    "staff-change-requests": { list: StaffChangeRequestList },
  },
  reports: {
    "monthly-waste-comparison": { list: MonthlyWasteComparisonListPage },
  },
  "leader-login": {
    "plb-leader-creation": { list: PanchayatLeaderListPage, form: PanchayatLeaderForm },
    "district-leader-creation": { list: DistrictLeaderListPage, form: DistrictLeaderForm },
    "state-leader-creation": { list: StateLeaderListPage, form: StateLeaderForm },
  },
};

export const MASTER_ALIASES: Record<string, string[]> = {
  // Sidebar permission/module names -> router route groups
  "screen-managements": ["screen-management", "admins"],
  "role-assigns": ["role-management", "admins"],
  // Backward-compat: old bookmarked/cached URLs whose encrypted segment still
  // decrypts to the legacy shared "admins" master resolve into both new buckets.
  admins: ["screen-management", "role-management", "admins"],
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

export const MODULE_ALIASES: Record<string, string[]> = {
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

  // Staff management
  staffcreation: ["staff-creation"],
  "staff-creation": ["staff-creation"],
  "staff-access-configuration": ["staff-access-configuration"],
  "staff-access-dashboard": ["staff-access-dashboard"],

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
  wards: ["wards"],

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
  "approval-history": ["approval-history"],
  "permission-audit": ["permission-audit"],
  "staff-change-requests": ["staff-change-requests"],

  // Leader login
  "plb-leader-creation": ["plb-leader-creation"],
  "district-leader-creation": ["district-leader-creation"],
  "state-leader-creation": ["state-leader-creation"],
};
