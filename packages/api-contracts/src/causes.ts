/**
 * What was noticed on equipment, as a primary cause and the secondary causes that belong to it. Choosing a primary cause
 * offers only its own secondary causes. These lists are a draft for the mine's maintenance and engineering leads to
 * confirm, and they are kept in one place so changing them changes the form, the checks and the report together.
 */
export const causeGroups = [
  {
    id: "hydraulic",
    label: "Hydraulic system",
    secondary: [
      { id: "hose_or_fitting_leak", label: "Hose or fitting leak" },
      { id: "cylinder_or_seal_leak", label: "Cylinder or seal leak" },
      { id: "pump_or_motor_fault", label: "Pump or motor fault" },
      { id: "valve_or_control_fault", label: "Valve or control fault" },
      { id: "oil_contaminated_or_low", label: "Oil contaminated or low" },
      { id: "oil_overheating", label: "Oil overheating" },
    ],
  },
  {
    id: "engine_fuel",
    label: "Engine and fuel",
    secondary: [
      { id: "overheating", label: "Overheating" },
      { id: "low_power", label: "Low power" },
      { id: "fuel_supply_problem", label: "Fuel supply problem" },
      { id: "air_or_exhaust_problem", label: "Air intake or exhaust problem" },
      { id: "starting_failure", label: "Starting failure" },
      { id: "engine_oil_leak_or_pressure", label: "Engine oil leak or low pressure" },
    ],
  },
  {
    id: "electrical_control",
    label: "Electrical and control",
    secondary: [
      { id: "wiring_or_connector_fault", label: "Wiring or connector fault" },
      { id: "sensor_or_instrument_fault", label: "Sensor or instrument fault" },
      { id: "battery_or_charging_fault", label: "Battery or charging fault" },
      { id: "control_or_software_fault", label: "Control unit or software fault" },
      { id: "electric_motor_fault", label: "Electric motor fault" },
      { id: "warning_or_alarm", label: "Warning light or alarm" },
    ],
  },
  {
    id: "drivetrain_brakes",
    label: "Drivetrain, brakes and steering",
    secondary: [
      { id: "gearbox_or_transmission_fault", label: "Gearbox or transmission fault" },
      { id: "final_drive_or_axle_fault", label: "Final drive or axle fault" },
      { id: "brake_wear_or_fade", label: "Brake wear or fade" },
      { id: "steering_fault", label: "Steering fault" },
      { id: "coupling_or_driveshaft_fault", label: "Coupling or driveshaft fault" },
      { id: "noise_or_vibration", label: "Unusual noise or vibration" },
    ],
  },
  {
    id: "undercarriage_tyres",
    label: "Undercarriage, tyres and wheels",
    secondary: [
      { id: "tyre_damage_or_wear", label: "Tyre damage or wear" },
      { id: "track_or_chain_wear", label: "Track or chain wear" },
      { id: "roller_or_idler_fault", label: "Roller or idler fault" },
      { id: "wheel_or_hub_fault", label: "Wheel or hub fault" },
      { id: "suspension_fault", label: "Suspension fault" },
    ],
  },
  {
    id: "structure_attachments",
    label: "Structure and attachments",
    secondary: [
      { id: "cracks_or_structural_damage", label: "Cracks or structural damage" },
      { id: "bucket_teeth_or_liner_wear", label: "Bucket, teeth or liner wear" },
      { id: "boom_or_arm_damage", label: "Boom or arm damage" },
      { id: "pins_and_bushes_wear", label: "Pins and bushes wear" },
      { id: "cab_or_guarding_damage", label: "Cab or guarding damage" },
    ],
  },
  {
    id: "process_plant",
    label: "Crushing, conveying and screening",
    secondary: [
      { id: "feed_blockage", label: "Feed blockage" },
      { id: "liner_or_wear_plate_wear", label: "Liner or wear plate wear" },
      { id: "belt_mistracking_or_damage", label: "Belt mistracking or damage" },
      { id: "chute_or_hopper_blockage", label: "Chute or hopper blockage" },
      { id: "screen_damage", label: "Screen damage" },
      { id: "plant_roller_or_idler_fault", label: "Conveyor roller or idler fault" },
    ],
  },
  {
    id: "external_conditions",
    label: "Operating conditions and external",
    secondary: [
      { id: "weather", label: "Weather" },
      { id: "ground_or_road_conditions", label: "Ground or road conditions" },
      { id: "collision_or_impact", label: "Collision or impact" },
      { id: "misuse_or_operator_error", label: "Misuse or operator error" },
      { id: "power_supply_interruption", label: "Power supply interruption" },
    ],
  },
  {
    id: "other",
    label: "Other",
    secondary: [],
  },
] as const;

export type CauseGroup = (typeof causeGroups)[number];
export type PrimaryCause = CauseGroup["id"];

export const primaryCauseIds = causeGroups.map((group) => group.id) as [PrimaryCause, ...PrimaryCause[]];

/** The secondary causes that belong to one primary cause. */
export function secondariesOf(primary: string): readonly { id: string; label: string }[] {
  return causeGroups.find((group) => group.id === primary)?.secondary ?? [];
}

export function isSecondaryOf(primary: string, secondary: string): boolean {
  return secondariesOf(primary).some((item) => item.id === secondary);
}
