import { z } from 'zod';

export const saveFieldSchema = z.object({
    name: z.string().min(1, 'Field name is required'),
    method: z.string().min(1),
    areaAcres: z.number().nonnegative(),
    perimeterMeters: z.number().nonnegative(),
    pointsJson: z.string().default('[]'),
    locationLabel: z.string().default(''),
    accentColor: z.string().default('#256b5a'),
});

export const renameFieldSchema = z.object({
    name: z.string().min(1),
});

export type SaveFieldInput = z.infer<typeof saveFieldSchema>;