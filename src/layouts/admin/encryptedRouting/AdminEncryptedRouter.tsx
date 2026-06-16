import { useMemo, type ComponentType } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";

import { decryptSegment } from "@/utils/routeCrypto";


// Import your actual page components
import ContinentList from "@/pages/admin/modules/masters/continent/ContinentListPage";
import ContinentForm from "@/pages/admin/modules/masters/continent/ContinentForm";
import CountryList from "@/pages/admin/modules/masters/country/CountryListPage";
import CountryForm from "@/pages/admin/modules/masters/country/CountryForm";
import StateList from "@/pages/admin/modules/masters/state/StateListPage";
import StateForm from "@/pages/admin/modules/masters/state/StateForm";
import DistrictList from "@/pages/admin/modules/masters/district/DistrictListPage";
import DistrictForm from "@/pages/admin/modules/masters/district/DistrictForm";
import CityList from "@/pages/admin/modules/masters/city/CityListPage";
import CityForm from "@/pages/admin/modules/masters/city/CityForm";
import ZoneList from "@/pages/admin/modules/masters/zone/ZoneListPage";
import ZoneForm from "@/pages/admin/modules/masters/zone/ZoneForm";
import WardList from "@/pages/admin/modules/masters/ward/WardListPage";
import WardForm from "@/pages/admin/modules/masters/ward/WardForm";
import DepartmentList from "@/pages/admin/modules/masters/department/DepartmentListPage";
import DepartmentForm from "@/pages/admin/modules/masters/department/DepartmentForm";
import DesignationList from "@/pages/admin/modules/masters/designation/DesignationListPage";
import DesignationForm from "@/pages/admin/modules/masters/designation/DesignationForm";
import CollectionPointListPage from "@/pages/admin/modules/masters/collectionPoint/CollectionPointListPage";
import CollectionPointForm from "@/pages/admin/modules/masters/collectionPoint/CollectionPointForm";
import WasteTypeListPage from "@/pages/admin/modules/masters/wasteType/WasteTypeListPage";
import WasteTypeForm from "@/pages/admin/modules/masters/wasteType/WasteTypeForm";
import BinListPage from "@/pages/admin/modules/masters/bin/BinListPage";
import BinForm from "@/pages/admin/modules/masters/bin/BinForm";


import PanchayatListPage from "@/pages/admin/modules/masters/panchayat/PanchayatListPage";
import PanchayatForm from "@/pages/admin/modules/masters/panchayat/PanchayatForm";
import PanchayatLeaderListPage from "@/pages/admin/modules/masters/panchayatLeader/PanchayatLeaderListPage";
import PanchayatLeaderForm from "@/pages/admin/modules/masters/panchayatLeader/PanchayatLeaderForm";
import AreaTypeListPage from "@/pages/admin/modules/masters/areaType/AreaTypeListPage";
import AreaTypeForm from "@/pages/admin/modules/masters/areaType/AreaTypeForm";
import HierarchyListPage from "@/pages/admin/modules/masters/hierarchy/HierarchyListPage";
import HierarchyForm from "@/pages/admin/modules/masters/hierarchy/HierarchyForm";
import MunicipalityListPage from "@/pages/admin/modules/masters/municipality/MunicipalityListPage";
import MunicipalityForm from "@/pages/admin/modules/masters/municipality/MunicipalityForm";
import TownPanchayatListPage from "@/pages/admin/modules/masters/townPanchayat/TownPanchayatListPage";
import TownPanchayatForm from "@/pages/admin/modules/masters/townPanchayat/TownPanchayatForm";
import BlockPanchayatUnionListPage from "@/pages/admin/modules/masters/blockPanchayatUnion/BlockPanchayatUnionListPage";
import BlockPanchayatUnionForm from "@/pages/admin/modules/masters/blockPanchayatUnion/BlockPanchayatUnionForm";


import PropertyList from "@/pages/admin/modules/masters/property/PropertyListPage";
import PropertyForm from "@/pages/admin/modules/masters/property/PropertyForm";
import SubPropertyList from "@/pages/admin/modules/masters/subproperty/SubPropertyListPage";
import SubPropertyForm from "@/pages/admin/modules/masters/subproperty/SubPropertyForm";
import StaffCreationList from "@/pages/admin/modules/staffMasters/staffCreation/staffcreationlist";
import StaffCreationForm from "@/pages/admin/modules/staffMasters/staffCreation/staffcreationForm";
// Admin
import UserTypeList from "@/pages/admin/modules/admin/userType/user-typeList";
import UserTypeForm from "@/pages/admin/modules/admin/userType/user-typeForm";
// Customer Master
import CustomerCreationList from "@/pages/admin/modules/customerMasters/customerCreations/customerCreationListPage";
import CustomerCreationForm from "@/pages/admin/modules/customerMasters/customerCreations/customerCreationForm";
import ApartmentListPage from "@/pages/admin/modules/customerMasters/customerCreations/apartmentListpage";
import HouseholdPickupEventList from "@/pages/admin/modules/customerMasters/householdPickupEvent/householdPickupEventList";
import HouseholdPickupEventForm from "@/pages/admin/modules/customerMasters/householdPickupEvent/householdPickupEventForm";

// Reports (Single components)
import TripSummary from "@/pages/admin/modules/reports/tripsummary/tripsummary";
import MonthlyDistance from "@/pages/admin/modules/reports/monthlydistance/monthlydistance";
import WasteSummary from "@/pages/admin/modules/reports/wasteCollectedSummary/wastesummary";
import MonthlyWasteComparisonListPage from "@/pages/admin/modules/reports/monthlyWasteComparison/MonthlyWasteComparisonListPage";
import MonthlyWasteComparisonForm from "@/pages/admin/modules/reports/monthlyWasteComparison/MonthlyWasteComparisonForm";
import ComplaintsList from "@/pages/admin/modules/citizienGrievance/complaints/complaintsList";
import ComplaintAddForm from "@/pages/admin/modules/citizienGrievance/complaints/complaintsForm";
import ComplaintEditForm from "@/pages/admin/modules/citizienGrievance/complaints/complaintsEditForm";
import FeedBackFormList from "@/pages/admin/modules/citizienGrievance/feedback/feedBackFormListPage";
import FeedBackForm from "@/pages/admin/modules/citizienGrievance/feedback/feedBackForm";
import FuelList from "@/pages/admin/modules/transportMasters/fuel/fuelListPage";
import FuelForm from "@/pages/admin/modules/transportMasters/fuel/fuelForm";
import VehicleTypeCreation from "@/pages/admin/modules/transportMasters/vehicleTypecreation/vehicle-typeCreationList";
import VehicleTypeCreationForm from "@/pages/admin/modules/transportMasters/vehicleTypecreation/vechicle-typeCreationForm";
import VehicleCreationListPage from "@/pages/admin/modules/transportMasters/vehicleCreation/vehicleCreationListPage";
import VehicleCreationForm from "@/pages/admin/modules/transportMasters/vehicleCreation/vehicleCreationForm";
import TripPlanList from "@/pages/admin/modules/transportMasters/tripPlan/tripPlanList";
import TripPlanForm from "@/pages/admin/modules/transportMasters/tripPlan/tripPlanForm";
import ZonePropertyLoadTrackerList from "@/pages/admin/modules/transportMasters/zonePropertyLoadTracker/zonePropertyLoadTrackerList";
import ZonePropertyLoadTrackerForm from "@/pages/admin/modules/transportMasters/zonePropertyLoadTracker/zonePropertyLoadTrackerForm";
import TripAttendanceList from "@/pages/admin/modules/transportMasters/tripAttendance/tripAttendanceList";
import TripAttendanceForm from "@/pages/admin/modules/transportMasters/tripAttendance/tripAttendanceForm";
import VehicleTripAuditList from "@/pages/admin/modules/transportMasters/vehicleTripAudit/vehicleTripAuditList";
import VehicleTripAuditForm from "@/pages/admin/modules/transportMasters/vehicleTripAudit/vehicleTripAuditForm";
import TripExceptionLogList from "@/pages/admin/modules/transportMasters/tripExceptionLog/tripExceptionLogList";
import TripExceptionLogForm from "@/pages/admin/modules/transportMasters/tripExceptionLog/tripExceptionLogForm";
import VehicleTracking from "@/pages/admin/modules/vehicletracking/vehicletrack/vehicletracking";
import VehicleHistory from "@/pages/admin/modules/vehicletracking/vehiclehistory/vehiclehistory";
import WorkforceManagement from "@/pages/admin/modules/workforcemanagement/workforcemanagement";
import DateReport from "@/pages/admin/modules/workforcemanagement/datereport";
import DayReport from "@/pages/admin/modules/workforcemanagement/dayreport";
import DailyTripAssignmentList from "@/pages/admin/modules/transportMasters/dailyTripAssignment/dailyTripAssignmentList"
import DailyTripAssignmentForm from "@/pages/admin/modules/transportMasters/dailyTripAssignment/dailyTripAssignmentForm";
import DailyTripCollectionPointList from "@/pages/admin/modules/transportMasters/dailyTripCollectionPoint/dailyTripCollectionPointList";
import DailyTripCollectionPointForm from "@/pages/admin/modules/transportMasters/dailyTripCollectionPoint/dailyTripCollectionPointForm";
import DailyTripHouseholdCollectionList from "@/pages/admin/modules/transportMasters/dailyTripHouseholdCollection/dailyTripHouseholdCollectionList";
import DailyTripTracking from "@/pages/admin/modules/scheduleMasters/dailyTripTracking/DailyTripTracking";
import DailyTripLogList from "@/pages/admin/modules/transportMasters/dailyTripLog/dailyTripLogList";

// import CollectionMonitoringListPage from "@/pages/admin/modules/wasteManagementMasters/pointcollection/CollectionMonitoringListPage";
// import CollectionMonitoringForm from "@/pages/admin/modules/wasteManagementMasters/pointcollection/CollectionMonitoringForm";
import PanchayatBaseCollectionListPage from "@/pages/admin/modules/wasteManagementMasters/panchayatbasecollection/PanchayatBaseCollectionListPage";
import WardBaseCollectionListPage from "@/pages/admin/modules/wasteManagementMasters/wardbasecollection/WardBaseCollectionListPage";
import WasteCollectedDataList from "@/pages/admin/modules/wasteManagementMasters/wasteCollectedData/wasteCollectedDataListPage";
import WasteCollectedForm from "@/pages/admin/modules/wasteManagementMasters/wasteCollectedData/wasteCollectedDataForm";
import StaffUserTypeForm from "@/pages/admin/modules/admin/staffUserType/staffUserTypeForm";
import StaffUserTypeList from "@/pages/admin/modules/admin/staffUserType/staffUserTypeList";

import MainComplaintCategoryList from "@/pages/admin/modules/citizienGrievance/mainCategory/main-categoryList";
import { MainComplaintCategoryForm } from "@/pages/admin/modules/citizienGrievance/mainCategory/main-categoryForm";
import SubCategoryComplaintList from "@/pages/admin/modules/citizienGrievance/subCategory/sub-categoryList";
import SubCategoryComplaintForm from "@/pages/admin/modules/citizienGrievance/subCategory/sub-categoryForm";
import MainScreenTypeList from "@/pages/admin/modules/admin/mainScreenType/mainScreenTypeList";
import MainScreenTypeForm from "@/pages/admin/modules/admin/mainScreenType/mainScreenTypeForm";
import UserScreenActionList from "@/pages/admin/modules/admin/userScreenAction/userScreenActionList";
import UserScreenActionForm from "@/pages/admin/modules/admin/userScreenAction/userScreenActionForm";
import MainScreenList from "@/pages/admin/modules/admin/mainScreen/mainScreenList";
import MainScreenForm from "@/pages/admin/modules/admin/mainScreen/mainScreenForm";
import UserScreenList from "@/pages/admin/modules/admin/userScreen/userScreenList";
import UserScreenForm from "@/pages/admin/modules/admin/userScreen/userScreenForm";
import UserScreenPermissionForm from "@/pages/admin/modules/admin/userScreenPermission/userScreenPermissionForm";
import UserScreenPermissionList from "@/pages/admin/modules/admin/userScreenPermission/userScreenPermissionList";
import StaffTemplateList from "@/pages/admin/modules/staffMasters/staffTemplate/staffTemplateList";
import StaffTemplateForm from "@/pages/admin/modules/staffMasters/staffTemplate/staffTemplateForm";
import AlternativeStaffTemplateList from "@/pages/admin/modules/staffMasters/alternativeStaffTemplate/alternativeStaffTemplateList";
import AlternativeStaffTemplateForm from "@/pages/admin/modules/staffMasters/alternativeStaffTemplate/alternativeStaffTemplateForm";
import TripPlanCollectionPointList from "@/pages/admin/modules/scheduleMasters/tripPlanCollectionPoint/tripPlanCollectionPointList";
import TripPlanCollectionPointForm from "@/pages/admin/modules/scheduleMasters/tripPlanCollectionPoint/tripPlanCollectionPointForm";
import BinCollectionEventList from "@/pages/admin/modules/scheduleMasters/binCollectionEvent/binCollectionEventList";
import BinCollectionEventForm from "@/pages/admin/modules/scheduleMasters/binCollectionEvent/binCollectionEventForm";
import DailyWasteComparisonList from "@/pages/admin/modules/scheduleMasters/dailyWasteComparison/dailyWasteComparisonList";
import DailyWasteComparisonForm from "@/pages/admin/modules/scheduleMasters/dailyWasteComparison/dailyWasteComparisonForm";
import StaffTemplateAuditList from "@/pages/admin/modules/staffMasters/staffTemplateAudit/staffTemplateAuditList";
import StaffTemplateAuditForm from "@/pages/admin/modules/staffMasters/staffTemplateAudit/staffTemplateAuditForm";
import SupervisorZoneMapList from "@/pages/admin/modules/staffMasters/supervisorZoneMap/supervisorZoneMapList";
import SupervisorZoneMapForm from "@/pages/admin/modules/staffMasters/supervisorZoneMap/supervisorZoneMapForm";
import SupervisorZoneAccessAuditList from "@/pages/admin/modules/staffMasters/supervisorZoneAccessAudit/supervisorZoneAccessAuditList";
import SupervisorZoneAccessAuditForm from "@/pages/admin/modules/staffMasters/supervisorZoneAccessAudit/supervisorZoneAccessAuditForm";
import CommonAuditList from "@/pages/admin/modules/audits/commonAudit/commonAuditList";
import LoginAuditList from "@/pages/admin/modules/audits/loginAudit/loginAuditList";
import UnassignedStaffPoolList from "@/pages/admin/modules/staffMasters/unassignedStaffPool/unassignedStaffPoolList";
import UnassignedStaffPoolForm from "@/pages/admin/modules/staffMasters/unassignedStaffPool/unassignedStaffPoolForm";
import CompanyList from "@/pages/admin/modules/superadminMasters/company/companyListPage";
import CompanyListForm from "@/pages/admin/modules/superadminMasters/company/companyForm";
import ProjectList from "@/pages/admin/modules/superadminMasters/project/projectListPage";
import ProjectForm from "@/pages/admin/modules/superadminMasters/project/projectForm";
import ExternalAttendanceList from "@/pages/admin/modules/attendance/ExternalAttendanceList";


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
    attendance: { component: ExternalAttendanceList },
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
  "superadmin-masters": {
    "company-creation": { list: CompanyList, form: CompanyListForm },
    "project-creation": { list: ProjectList, form: ProjectForm },
  },
  masters: {
    continents: { list: ContinentList, form: ContinentForm },
    countries: { list: CountryList, form: CountryForm },
    states: { list: StateList, form: StateForm },
    districts: { list: DistrictList, form: DistrictForm },
    cities: { list: CityList, form: CityForm },
    zones: { list: ZoneList, form: ZoneForm },
    wards: { list: WardList, form: WardForm },
    departments: { list: DepartmentList, form: DepartmentForm },
    designations: { list: DesignationList, form: DesignationForm },
    bins: { list: BinListPage, form: BinForm },
    "waste-types": { list: WasteTypeListPage, form: WasteTypeForm },
    // bins: { list: BinListPage, form: BinForm },


    panchayats: { list: PanchayatListPage, form: PanchayatForm },
    "panchayat-leaders": { list: PanchayatLeaderListPage, form: PanchayatLeaderForm },
    "area-types": { list: AreaTypeListPage, form: AreaTypeForm },
    hierarchies: { list: HierarchyListPage, form: HierarchyForm },
    municipalities: { list: MunicipalityListPage, form: MunicipalityForm },
    "town-panchayats": { list: TownPanchayatListPage, form: TownPanchayatForm },
    "block-panchayat-unions": { list: BlockPanchayatUnionListPage, form: BlockPanchayatUnionForm },

    
    properties: { list: PropertyList, form: PropertyForm },
    "sub-properties": { list: SubPropertyList, form: SubPropertyForm },
  },
  "staff-masters": {
    "staff-creation": { list: StaffCreationList, form: StaffCreationForm },
    "staff-template-audit": { list: StaffTemplateAuditList, form: StaffTemplateAuditForm },
    "supervisor-zone-map": { list: SupervisorZoneMapList, form: SupervisorZoneMapForm },
    "supervisor-zone-access-audit": { list: SupervisorZoneAccessAuditList, form: SupervisorZoneAccessAuditForm },
    "unassigned-staff-pool": { list: UnassignedStaffPoolList, form: UnassignedStaffPoolForm },
  },
  "transport-master": {
    fuel: { list: FuelList, form: FuelForm },
    "vehicle-type": { list: VehicleTypeCreation, form: VehicleTypeCreationForm },
    "vehicle-creation": { list: VehicleCreationListPage, form: VehicleCreationForm },
    "zone-property-load-tracker": { list: ZonePropertyLoadTrackerList, form: ZonePropertyLoadTrackerForm },
    "trip-attendance": { list: TripAttendanceList, form: TripAttendanceForm },
    "vehicle-trip-audit": { list: VehicleTripAuditList, form: VehicleTripAuditForm },
    "trip-exception-log": { list: TripExceptionLogList, form: TripExceptionLogForm },
  },
  "schedule-masters": {
    "staff-template": {list: StaffTemplateList, form: StaffTemplateForm},
    "alternative-staff-template": {list: AlternativeStaffTemplateList, form: AlternativeStaffTemplateForm},
    "collection-points": { list: CollectionPointListPage, form: CollectionPointForm },
    "trip-plans": { list: TripPlanList, form: TripPlanForm },
    "trip-plan-collection-points": { list: TripPlanCollectionPointList, form: TripPlanCollectionPointForm },
    "daily-trip-assignment": { list: DailyTripAssignmentList, form: DailyTripAssignmentForm },
    "daily-trip-collection-point": { list: DailyTripCollectionPointList, form: DailyTripCollectionPointForm },
    "daily-trip-household-collection": { list: DailyTripHouseholdCollectionList },
    "daily-trip-tracking": { component: DailyTripTracking },
    "bin-collection-event": { list: BinCollectionEventList, form: BinCollectionEventForm },
    "daily-trip-log": { list: DailyTripLogList },
    "daily-waste-comparisons": { list: DailyWasteComparisonList, form: DailyWasteComparisonForm },
    "monthly-waste-comparison": { list: MonthlyWasteComparisonListPage, form: MonthlyWasteComparisonForm },
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
    "waste-collected-data": { list: WasteCollectedDataList, form: WasteCollectedForm },
    // "collection-monitoring": { list: CollectionMonitoringListPage, form: CollectionMonitoringForm },
    "panchayat-base-collection": { list: PanchayatBaseCollectionListPage },
    "ward-base-collection": { list: WardBaseCollectionListPage },
  },
  "workforce-management": {
    "workforce-management": { component: WorkforceManagement },
    "date-report": { component: DateReport },
    "day-report": { component: DayReport },
  },
  "citizen-grievance": {
    complaint: { list: ComplaintsList, form: ComplaintAddForm, editForm: ComplaintEditForm },
    "main-complaint-category": { list: MainComplaintCategoryList, form: MainComplaintCategoryForm },
    "sub-complaint-category": { list: SubCategoryComplaintList, form: SubCategoryComplaintForm },
    feedback: { list: FeedBackFormList, form: FeedBackForm },
  },
  audits: {
    "common-audit": { list: CommonAuditList },
    "login-audit": { list: LoginAuditList },
    "login-audits": { list: LoginAuditList },
  },
  reports: {
    "trip-summary": { component: TripSummary },
    "monthly-distance": { component: MonthlyDistance },
    "waste-collected-summary": { component: WasteSummary },
    "monthly-waste-comparison": { list: MonthlyWasteComparisonListPage, form: MonthlyWasteComparisonForm },
  },
};

const MASTER_ALIASES: Record<string, string[]> = {
  "screen-managements": ["admins"],
  "role-assigns": ["admins"],
  "customer-masters": ["customer-master"],
  "transport-masters": ["transport-master"],
  "schedule-masters": ["schedule-masters"],
  "user-creations": ["staff-masters"],
  "process-items": ["staff-masters"],
  audits: ["staff-masters"],
  grivences: ["citizen-grievance"],
  superadmin: ["superadmin-masters"],
  "common-masters": ["masters"],
  "waste-types": ["masters"],
  assets: ["masters"],
  collections: ["waste-management"],
};

const MODULE_ALIASES: Record<string, string[]> = {
  complaint: ["complaints"],
  "main-complaint-category": ["main-category"],
  "sub-complaint-category": ["sub-category"],
  feedback: ["feedbacks"],
  fuel: ["fuels"],
  panchayats: ["panchayat"],
  "area-types": ["areatypes"],
  hierarchies: ["hierarchy"],
  "collection-points": ["collection-point"],
  "sub-properties": ["subproperties"],
  "staff-user-type": ["staffusertypes"],
  "mainscreen-type": ["mainscreentype"],
  userscreenpermissions: ["companywisescreenpermissions"],
  "company-creation": ["company"],
  "project-creation": ["project"],
  "customer-creation": ["customercreations"],
  "staff-templates": ["staff-template"],
  "alternative-staff-templates": ["alternative-staff-template"],
  "daily-trip-assignments": ["daily-trip-assignment"],
  "daily-trip-collection-points": ["daily-trip-collection-point"],
  "daily-trip-household-collections": ["daily-trip-household-collection"],
  "bin-collection-events": ["bin-collection-event"],
  "daily-trip-logs": ["daily-trip-log"],
};

const resolveRouteConfig = (
  master: string,
  moduleName: string,
): RouteConfig | undefined => {
  const masterCandidates = [master, ...(MASTER_ALIASES[master] ?? [])];
  const moduleCandidates = [moduleName, ...(MODULE_ALIASES[moduleName] ?? [])];

  for (const masterCandidate of masterCandidates) {
    const routeGroup = ROUTES[masterCandidate];
    if (!routeGroup) {
      continue;
    }

    for (const moduleCandidate of moduleCandidates) {
      const routeConfig = routeGroup[moduleCandidate];
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

  const mode: "view" | "new" | "edit" = id ? "edit" : location.pathname.endsWith("/new") ? "new" : "view";
    const Component = resolveComponent(moduleRoutes, mode);

  if (!Component) {
    return <Navigate to="/" replace />;
  }

  return <Component />;
}
