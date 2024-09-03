import { Router } from 'express';
import { logError } from 'src/utils/utils-logger';
import { updateServiceExec } from '../services/update.service';

const router = Router();

router.post('/api/update/service', async (req, res, next) => {
  const tokenBody = req.body.token;
  const serviceNameBody = req.body.serviceName;
  const isForceBody = req.body.isForce;
  const imageBody = req.body.image;

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
  if (typeof imageBody !== 'string' || imageBody.length === 0) {
    res.status(400).json({
      message: 'Incorrect request',
    });
    return;
  }

  try {
    const result = await updateServiceExec({
      token: tokenBody,
      serviceName: serviceNameBody,
      force: typeof isForceBody === 'boolean' ? isForceBody : false,
      image: imageBody,
    });
    res.json(result);
  } catch (err) {
    const bodyErr = logError('request.api_update_service.API_ERROR', err, {
      body: req.body,
    });
    res.status(400).json(bodyErr);
  }
});

export { router as apiUpdateRouter };
