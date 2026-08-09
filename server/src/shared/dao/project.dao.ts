// Importing modules
import Project from "../models/project.model.js";

// class to handle project data access operations
class ProjectDao {

    ProjectModel: any;

    constructor() {

        // initializing the project model
        this.ProjectModel = Project;

    }

    // function to create a new project
    async createProject(projectData) {

        // creating a new project using the project model and returning it
        const project = await this.ProjectModel.create(projectData);
        return project;

    }

    // function to find a project by id
    async findProjectById(id) {

        // finding a project by id and returning it
        return await this.ProjectModel.findById(id);

    }

    // function to update a project by id
    async updateProjectById(id, updateData) {

        // updating a project by id using findByIdAndUpdate
        return await this.ProjectModel.findByIdAndUpdate(id, updateData, {
            new: true
        });

    }

    // function to update project timeline state
    async updateProjectTimeline(id, timelineState) {

        return await this.ProjectModel.findByIdAndUpdate(id, {
            timelineState: timelineState
        }, {
            new: true
        });

    }

    // function to update project Google Drive folder ID
    async updateProjectDriveFolder(id, driveFolderId) {

        return await this.ProjectModel.findByIdAndUpdate(id, {
            driveFolderId: driveFolderId
        }, {
            new: true
        });

    }

    // function to find projects matching filter
    async find(filter = {}, options: any = {}) {

        let query = this.ProjectModel.find(filter);

        if (options.sort) {
            query = query.sort(options.sort);
        }

        if (options.limit) {
            query = query.limit(options.limit);
        }

        if (options.skip) {
            query = query.skip(options.skip);
        }

        return await query;

    }

    // function to delete a project by id
    async deleteProjectById(id) {

        // deleting a project by id and returning the deleted record
        return await this.ProjectModel.findByIdAndDelete(id);

    }

}

export default ProjectDao;
