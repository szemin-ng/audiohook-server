import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import path from "path";
import * as fsPromises from "fs/promises";
import logger from "./log";
import { environment } from "./environment";

type AudioFile = {
  id: string;
  date: Date;
  url: string;
}

export async function deleteFile(req: Request, res: Response, next: NextFunction) {
  try {
    await fsPromises.unlink(path.join(__dirname, environment.mediaPath, `${req.params.id}.wav`));
    res.status(StatusCodes.OK).json({});
  } catch (err) {
    next(err);
  }
}

export async function listAudioFiles(req: Request, res: Response, next: NextFunction) {
  try {
    // get list of .wav files
    let files = (await fsPromises.readdir(path.join(__dirname, environment.mediaPath))).filter(f => f.endsWith(".wav"));

    // create AudioFile[]
    // Intentionally Using a for loop here
    let audioFiles: AudioFile[] = [];
    for (let i = 0; i < files.length; i++) {
      let modifiedDate = (await fsPromises.stat(path.join(__dirname, environment.mediaPath, files[i]))).mtime;
      let audioFile: AudioFile = {
        id: files[i].replace(".wav", ""),
        date: modifiedDate,
        url: `/media/${files[i]}`
      }
      audioFiles.push(audioFile);
    }

    res.status(StatusCodes.OK).json(audioFiles);

    if (next) next();
  } catch (err) {
    next(err);
  }
}