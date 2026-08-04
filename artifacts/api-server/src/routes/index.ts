import { Router, type IRouter } from "express";
import healthRouter from "./health";
import deezerRouter from "./deezer";
import songsRouter from "./songs";
import rarityTypesRouter from "./rarityTypes";
import collectedCardsRouter from "./collectedCards";
import playlistsRouter from "./playlists";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(deezerRouter);
router.use(songsRouter);
router.use(rarityTypesRouter);
router.use(collectedCardsRouter);
router.use(playlistsRouter);
router.use(statsRouter);

export default router;
