import {createVehicle} from '../services/fleetService.js';
import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  previewRoute,
  assignRoute,
  replanRoute,
  getActiveRoutes,
  getRouteById,
  getVehicles,
} from '../services/routeService.js';

const router = express.Router();
const operatorAuth = [authenticate, requireRole(['OPERATOR'])];

router.post('/routes/preview', ...operatorAuth, async (req, res, next) => {
  try {
    const result = await previewRoute(req.body, req.user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/routes/:id/assign', ...operatorAuth, async (req, res, next) => {
  try {
    const result = await assignRoute(req.params.id, req.user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/routes/:id/replan', ...operatorAuth, async (req, res, next) => {
  try {
    const result = await replanRoute(req.params.id, req.body, req.user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/routes', ...operatorAuth, async (req, res, next) => {
  try {
    const result = await getActiveRoutes();
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/routes/:id', ...operatorAuth, async (req, res, next) => {
  try {
    const result = await getRouteById(req.params.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/vehicles', ...operatorAuth, async(req,res,next)=>{try{res.status(201).json(await createVehicle(req.body));}catch(err){next(err);}});

router.get('/vehicles', ...operatorAuth, async (req, res, next) => {
  try {
    const result = await getVehicles();
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export const routeRoutes = router;
