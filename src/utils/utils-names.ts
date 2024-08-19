const prefix = 'swarm-utils';
const prefix_lock = 'swarm-utils-lock';

// service.name / node.id_node.name
export function nameLock(key: string) {
  return `${prefix_lock}_${key}`;
}

//---------
//NODE
//---------

// node.id_node.name
export function nameCleanNodeImages(key: string) {
  return `${prefix}_clean-node_${key}_images`;
}
export function nameCleanNodeBuilder(key: string) {
  return `${prefix}_clean-node_${key}_builder`;
}
export function nameCleanNodeContainers(key: string) {
  return `${prefix}_clean-node_${key}_containers`;
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
  return `${prefix}_clean-service_${key}_exec`;
}

// service.name
export function nameBackupServiceExec(key: string) {
  return `${prefix}_backup-service_${key}_exec`;
}
export function nameBackupServiceScaleDown(key: string) {
  return `${prefix}_backup-service_${key}_scale-down`;
}
export function nameBackupServiceTarUpload(key: string) {
  return `${prefix}_backup-service_${key}_tar-upload`;
}
export function nameBackupServiceScaleUp(key: string) {
  return `${prefix}_backup-service_${key}_scale-up`;
}

// service.name
export function nameUpdateService(key: string) {
  return `${prefix}_update-service_${key}`;
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
