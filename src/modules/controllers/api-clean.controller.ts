import { Router } from 'express';
import { logError } from 'src/utils/utils-logger';
import { cleanNodeExec, cleanServiceExec } from '../services/clean.service';

const router = Router();

router.post('/api/clean/service', async (req, res, next) => {
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
    const result = await cleanServiceExec({
      token: tokenBody,
      serviceName: serviceNameBody,
    });
    res.json(result);
  } catch (err) {
    const bodyErr = logError('request.api_clean_service.API_ERROR', err, {
      body: req.body,
    });
    res.status(400).json(bodyErr);
  }
});

router.post('/api/clean/node', async (req, res, next) => {
  const tokenBody = req.body.token;
  const nodeNameBody = req.body.nodeName;

  if (typeof tokenBody !== 'string' || tokenBody.length === 0) {
    res.status(400).json({
      message: 'Incorrect request',
    });
    return;
  }
  if (typeof nodeNameBody !== 'string' || nodeNameBody.length === 0) {
    res.status(400).json({
      message: 'Incorrect request',
    });
    return;
  }

  try {
    const result = await cleanNodeExec({
      token: tokenBody,
      nodeName: nodeNameBody,
    });
    res.json(result);
  } catch (err) {
    const bodyErr = logError('request.api_clean_node.API_ERROR', err, {
      body: req.body,
    });
    res.status(400).json(bodyErr);
  }
});

export { router as apiCleanRouter };
