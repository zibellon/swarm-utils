const prefix = 'swarm_utils';
const prefix_lock = 'swarm_utils_lock';

// service.name / node.id_node.name
export function nameLock(key: string) {
  return `${prefix_lock}-${key}`;
}

//---------
//NODE
//---------

// node.id_node.name
export function nameCleanNodeImages(key: string) {
  return `${prefix}-clean_node-${key}-images`;
}
export function nameCleanNodeBuilder(key: string) {
  return `${prefix}-clean_node-${key}-builder`;
}
export function nameCleanNodeContainers(key: string) {
  return `${prefix}-clean_node-${key}-containers`;
}

// node.id_node.name
export function nameGetAllServiceNamesForNode(key: string) {
  return [nameCleanNodeImages(key), nameCleanNodeBuilder(key), nameCleanNodeContainers(key)];
}

//---------
//SERVICE
//---------

// service.name
export function nameCleanServiceExec(key: string) {
  return `${prefix}-clean_service-${key}-exec`;
}

// service.name
export function nameBackupServiceExec(key: string) {
  return `${prefix}-backup_service-${key}-exec`;
}
export function nameBackupServiceScaleDown(key: string) {
  return `${prefix}-backup_service-${key}-scale_down`;
}
export function nameBackupServiceTarUpload(key: string) {
  return `${prefix}-backup_service-${key}-tar_upload`;
}
export function nameBackupServiceScaleUp(key: string) {
  return `${prefix}-backup_service-${key}-scale_up`;
}

// service.name
export function nameUpdateService(key: string) {
  return `${prefix}-update_service-${key}`;
}

// service.name
export function nameGetAllServiceNamesForService(key: string) {
  return [
    nameCleanServiceExec(key),
    nameBackupServiceExec(key),
    nameBackupServiceScaleDown(key),
    nameBackupServiceTarUpload(key),
    nameBackupServiceScaleUp(key),
    nameUpdateService(key),
  ];
}
