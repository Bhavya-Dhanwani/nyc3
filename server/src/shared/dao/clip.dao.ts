// Importing modules
import Clip from "../models/clip.model.js";

// class to handle clip data access operations
class ClipDao {

    ClipModel: any;

    constructor() {

        // initializing the clip model
        this.ClipModel = Clip;

    }

    // function to create a new clip
    async createClip(clipData) {

        // creating a new clip using the clip model
        return await this.ClipModel.create(clipData);

    }

    // function to find clips by project id sorted by rank/createdAt
    async findClipsByProjectId(projectId) {

        // returning clips matching project id
        return await this.ClipModel.find({
            projectId: projectId
        });

    }

    // function to find a clip by its candidate id
    async findClipByCandidateId(candidateId) {

        // finding a clip matching candidate id
        return await this.ClipModel.findOne({
            candidateId: candidateId
        });

    }

    // function to update a clip by its candidate id
    async updateClipByCandidateId(candidateId, updateData) {

        // updating a clip matching candidate id
        return await this.ClipModel.findOneAndUpdate({
            candidateId: candidateId
        }, updateData, {
            new: true,
            upsert: true
        });

    }

    // function to update a clip by its primary id
    async updateClipById(clipId, updateData) {

        return await this.ClipModel.findByIdAndUpdate(clipId, updateData, {
            new: true
        });

    }

    // function to delete all clips for a project
    async deleteClipsByProjectId(projectId) {

        // deleting all clips matching project id
        return await this.ClipModel.deleteMany({
            projectId: projectId
        });

    }

}

export default ClipDao;
