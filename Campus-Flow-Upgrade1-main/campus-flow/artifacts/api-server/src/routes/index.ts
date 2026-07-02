import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import exeatsRouter from "./exeats";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/exeats", exeatsRouter);

export default router;
