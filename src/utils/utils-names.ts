const prefix = 'swarm-utils';

// node.name
export function nameCleanNode(key: string) {
  return `${prefix}_clean-node_${key}`;
}

// service.name
export function nameCleanService(key: string) {
  return `${prefix}_clean-service_${key}`;
}

// service.name
export function nameLockBackupService(key: string) {
  return `${prefix}_backup-service_${key}`;
}
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
