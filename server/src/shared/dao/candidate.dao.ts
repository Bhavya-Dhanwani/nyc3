// Importing modules
import Candidate from "../models/candidate.model.js";

// class to handle candidate data access operations
class CandidateDao {

    CandidateModel: any;

    constructor() {

        // initializing the candidate model
        this.CandidateModel = Candidate;

    }

    // function to create a new candidate
    async createCandidate(candidateData) {

        // creating a new candidate record using the model
        return await this.CandidateModel.create(candidateData);

    }

    // function to find candidates by project id sorted by rank
    async findCandidatesByProjectId(projectId) {

        // returning candidates matching project id sorted by rank ascending
        return await this.CandidateModel.find({
            projectId: projectId
        }).sort({
            rank: 1
        });

    }

    // function to find a candidate by id
    async findCandidateById(id) {

        // finding a candidate by id
        return await this.CandidateModel.findById(id);

    }

    // function to update a candidate by id
    async updateCandidateById(id, updateData) {

        // updating a candidate by id
        return await this.CandidateModel.findByIdAndUpdate(id, updateData, {
            new: true
        });

    }

    // function to delete all candidates for a project
    async deleteCandidatesByProjectId(projectId) {

        // deleting all candidates matching project id
        return await this.CandidateModel.deleteMany({
            projectId: projectId
        });

    }

}

export default CandidateDao;
