import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireEnum } from "../lib/validate";
import { badRequest, notFound } from "../lib/errors";

const DOCUMENT_TYPES = ["Insurance", "Registration", "Permit", "PUC", "Fitness", "Other"] as const;

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads", "vehicle-documents");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router({ mergeParams: true });
router.use(requireAuth);

function expiryFlags(expiryDate: Date | null) {
  if (!expiryDate) return { expired: false, expiringSoon: false };
  const days = (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return { expired: days < 0, expiringSoon: days >= 0 && days < 30 };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const vehicleId = Number(req.params.vehicleId);
    const documents = await prisma.vehicleDocument.findMany({
      where: { vehicleId },
      orderBy: { uploadedAt: "desc" },
    });
    res.status(200).json(documents.map((d) => ({ ...d, ...expiryFlags(d.expiryDate) })));
  })
);

router.post(
  "/",
  requireRole("FleetManager"),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const vehicleId = Number(req.params.vehicleId);
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw notFound(`Vehicle with id ${vehicleId} does not exist`);
    if (!req.file) throw badRequest("A 'file' upload is required");

    const type = requireEnum(req.body, "type", DOCUMENT_TYPES);
    const expiryDate = req.body?.expiryDate ? new Date(req.body.expiryDate) : null;

    const document = await prisma.vehicleDocument.create({
      data: {
        vehicleId,
        type,
        fileName: req.file.originalname,
        filePath: req.file.filename,
        expiryDate,
        uploadedById: req.user?.id,
      },
    });
    res.status(201).json({ ...document, ...expiryFlags(document.expiryDate) });
  })
);

router.get(
  "/:documentId/download",
  asyncHandler(async (req, res) => {
    const vehicleId = Number(req.params.vehicleId);
    const documentId = Number(req.params.documentId);
    const document = await prisma.vehicleDocument.findFirst({ where: { id: documentId, vehicleId } });
    if (!document) throw notFound(`Document with id ${documentId} does not exist for vehicle ${vehicleId}`);
    res.download(path.join(UPLOAD_DIR, document.filePath), document.fileName);
  })
);

router.delete(
  "/:documentId",
  requireRole("FleetManager"),
  asyncHandler(async (req, res) => {
    const vehicleId = Number(req.params.vehicleId);
    const documentId = Number(req.params.documentId);
    const document = await prisma.vehicleDocument.findFirst({ where: { id: documentId, vehicleId } });
    if (!document) throw notFound(`Document with id ${documentId} does not exist for vehicle ${vehicleId}`);

    await prisma.vehicleDocument.delete({ where: { id: documentId } });
    fs.unlink(path.join(UPLOAD_DIR, document.filePath), () => {});
    res.status(204).send();
  })
);

export default router;
