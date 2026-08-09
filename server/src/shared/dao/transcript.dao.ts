// Importing modules
import Transcript from "../models/transcript.model.js";

// class to handle transcript data access operations
class TranscriptDao {

    TranscriptModel: any;

    constructor() {

        // initializing the transcript model
        this.TranscriptModel = Transcript;

    }

    // function to create a new transcript
    async createTranscript(transcriptData) {

        // creating a new transcript using the transcript model
        const transcript = await this.TranscriptModel.create(transcriptData);
        return transcript;

    }

    // function to find the latest transcript by project id
    async findTranscriptByProjectId(projectId) {

        // finding transcript by project id sorting by createdAt descending
        return await this.TranscriptModel.findOne({
            projectId: projectId
        }).sort({
            createdAt: -1
        });

    }

    // function to delete transcript by project id
    async deleteTranscriptByProjectId(projectId) {

        // deleting transcripts matching project id
        return await this.TranscriptModel.deleteMany({
            projectId: projectId
        });

    }

}

export default TranscriptDao;
