import { Router } from 'express';
import { logError } from 'src/utils/utils-logger';
import { backupServiceExec } from '../services/backup.service';

const router = Router();

router.post('/api/backup/service', async (req, res, next) => {
  const tokenBody = req.body.token;
  const serviceNameBody = req.body.serviceName;

  if (typeof tokenBody !== 'string' || tokenBody.length === 0) {
    res.status(400).json({
      message: 'Incorrect request',
    });
    return;
  }
  if (typeof serviceNameBody !== 'string' || serviceNameBody.length === 0) {
    res.status(400).json({
      message: 'Incorrect request',
    });
    return;
  }

  try {
    const result = await backupServiceExec({
      token: tokenBody,
      serviceName: serviceNameBody,
    });
    res.json(result);
  } catch (err) {
    const bodyErr = logError('request.api_backup_service.API_ERROR', err, {
      body: req.body,
    });
    res.status(400).json(bodyErr);
  }
});

export { router as apiBackupRouter };
