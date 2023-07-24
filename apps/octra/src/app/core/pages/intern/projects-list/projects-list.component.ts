import { Component, OnInit } from '@angular/core';
import { OctraAPIService } from '@octra/ngx-octra-api';
import { AppStorageService } from '../../../shared/service/appstorage.service';
import { ProjectDto } from '@octra/api-types';
import { DefaultComponent } from '../../../component/default.component';
import { OctraModalService } from '../../../modals/octra-modal.service';
import { ErrorModalComponent } from '../../../modals/error-modal/error-modal.component';
import { AuthenticationStoreService } from '../../../store/authentication';
import { AnnotationStoreService } from '../../../store/annotation/annotation.store.service';

@Component({
  selector: 'octra-projects-list',
  templateUrl: './projects-list.component.html',
  styleUrls: ['./projects-list.component.scss'],
})
export class ProjectsListComponent extends DefaultComponent implements OnInit {
  projects: ProjectDto[] = [];
  selectedFile?: File;

  constructor(
    private api: OctraAPIService,
    public appStorage: AppStorageService,
    private modalService: OctraModalService,
    public authStoreService: AuthenticationStoreService,
    private annotationStoreService: AnnotationStoreService
  ) {
    super();
  }

  async ngOnInit() {
    this.subscrManager.add(
      this.api.listProjects().subscribe({
        next: (projects) => {
          this.projects = projects.filter((a) => {
            const annotationStatistics = a.statistics?.tasks.find(
              (a) => a.type === 'annotation'
            );

            if (annotationStatistics) {
              if (annotationStatistics.status.free > 0) {
                return true;
              }
            }

            return false;
          });

          this.projects.sort((a, b) => {
            if (a.active && !b.active) {
              return 1;
            } else if (a.active && b.active) {
              const annotationStatisticsA =
                a.statistics!.tasks.find((c) => c.type === 'annotation')?.status
                  .free ?? 0;
              const annotationStatisticsB =
                b.statistics!.tasks.find((c) => c.type === 'annotation')?.status
                  .free ?? 0;

              if (annotationStatisticsA > annotationStatisticsB) {
                return 1;
              } else if (annotationStatisticsA < annotationStatisticsB) {
                return annotationStatisticsA === 0 ? -1 : 1;
              }
              return 0;
            }
            return -1;
          });
        },
        error: (error) => {
          const ref = this.modalService.openModalRef<ErrorModalComponent>(
            ErrorModalComponent,
            ErrorModalComponent.options
          );
          ref.componentInstance.text = error.message;
        },
      })
    );
  }

  onProjectClick(project: ProjectDto) {
    this.appStorage.startOnlineAnnotation(project);
  }

  resumeTaskManually() {
    this.annotationStoreService.resumeTaskManually();
  }

  getFreeAnnotationTasks(project: ProjectDto) {
    return project.statistics?.tasks.find((a) => a.type === 'annotation')?.status
        .free ?? 0
  }
}